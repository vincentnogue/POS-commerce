import { useEffect, useRef, useState } from 'react';
import { MessageCircle, X, Send, Headset, Sparkles } from 'lucide-react';
import { useAuth } from '../lib/auth';

type ChatMessage = { id: string; sender: 'visitor' | 'ai' | 'agent'; content: string; created_at: string };

function getVisitorToken(): string {
  const key = 'posflow_support_token';
  let token = localStorage.getItem(key);
  if (!token) {
    token = crypto.randomUUID();
    localStorage.setItem(key, token);
  }
  return token;
}

async function callSupportChat(body: Record<string, unknown>) {
  const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/support-chat`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: import.meta.env.VITE_SUPABASE_ANON_KEY },
    body: JSON.stringify(body),
  });
  return res.json();
}

export function SupportChatWidget() {
  const { user, tenant } = useAuth();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState<'ai' | 'pending_human' | 'active' | 'closed'>('ai');
  const [unread, setUnread] = useState(0);
  const [started, setStarted] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const tokenRef = useRef<string>('');
  const lastMsgTimeRef = useRef<string>('1970-01-01');

  useEffect(() => { tokenRef.current = getVisitorToken(); }, []);

  const start = async () => {
    if (started) return;
    setStarted(true);
    const result = await callSupportChat({
      action: 'start_or_get',
      visitor_token: tokenRef.current,
      tenant_id: tenant?.id ?? null,
      user_id: user?.id ?? null,
      visitor_email: user?.email ?? null,
    });
    if (result.conversation) {
      setStatus(result.conversation.status);
      const msgs = result.messages ?? [];
      if (msgs.length === 0) {
        setMessages([{ id: 'welcome', sender: 'ai', content: "Bonjour 👋 Je suis l'assistant POS Flow. Posez-moi vos questions sur la plateforme, ou demandez à parler à un membre de l'équipe à tout moment.", created_at: new Date().toISOString() }]);
      } else {
        setMessages(msgs);
        lastMsgTimeRef.current = msgs[msgs.length - 1].created_at;
      }
    }
  };

  useEffect(() => { if (open) start(); }, [open]);

  // Poll for agent replies while the widget is open (also keeps working if
  // minimized but the conversation is in human handoff).
  useEffect(() => {
    if (!open || !started) return;
    const interval = setInterval(async () => {
      const result = await callSupportChat({ action: 'poll', visitor_token: tokenRef.current, since: lastMsgTimeRef.current });
      if (result.messages?.length) {
        setMessages((prev) => [...prev, ...result.messages]);
        lastMsgTimeRef.current = result.messages[result.messages.length - 1].created_at;
        if (!open) setUnread((u) => u + result.messages.length);
      }
      if (result.status) setStatus(result.status);
    }, 4000);
    return () => clearInterval(interval);
  }, [open, started]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);
  useEffect(() => { if (open) setUnread(0); }, [open]);

  const send = async () => {
    const text = input.trim();
    if (!text || sending) return;
    setInput('');
    setSending(true);
    const optimistic: ChatMessage = { id: `local-${Date.now()}`, sender: 'visitor', content: text, created_at: new Date().toISOString() };
    setMessages((prev) => [...prev, optimistic]);
    try {
      const result = await callSupportChat({ action: 'send', visitor_token: tokenRef.current, message: text });
      if (result.reply) {
        setMessages((prev) => [...prev, { id: `reply-${Date.now()}`, sender: 'ai', content: result.reply, created_at: new Date().toISOString() }]);
      }
      if (result.handedOff) setStatus('pending_human');
      lastMsgTimeRef.current = new Date().toISOString();
    } finally {
      setSending(false);
    }
  };

  const requestHuman = async () => {
    setSending(true);
    try {
      const result = await callSupportChat({ action: 'request_human', visitor_token: tokenRef.current });
      setStatus('pending_human');
      if (result.reply) setMessages((prev) => [...prev, { id: `human-${Date.now()}`, sender: 'agent', content: result.reply, created_at: new Date().toISOString() }]);
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setOpen((v) => !v)}
        className="fixed bottom-5 right-5 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-brand-500 text-white shadow-lg transition hover:bg-brand-600 hover:scale-105"
        aria-label="Support"
      >
        {open ? <X size={22} /> : <MessageCircle size={22} />}
        {!open && unread > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-error-500 text-[10px] font-bold text-white">{unread}</span>
        )}
      </button>

      {open && (
        <div className="fixed bottom-24 right-5 z-50 flex h-[520px] w-[360px] max-w-[calc(100vw-2.5rem)] flex-col overflow-hidden rounded-2xl border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-800 shadow-2xl">
          <div className="flex items-center gap-2 border-b border-ink-100 dark:border-ink-800 bg-brand-500 px-4 py-3 text-white">
            {status === 'ai' ? <Sparkles size={18} /> : <Headset size={18} />}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold">Support POS Flow</p>
              <p className="text-[11px] text-brand-50">
                {status === 'ai' && "Assistant IA — en ligne"}
                {status === 'pending_human' && "En attente d'un agent…"}
                {status === 'active' && 'Un agent vous répond'}
                {status === 'closed' && 'Conversation clôturée'}
              </p>
            </div>
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4 scroll-thin">
            {messages.map((m) => (
              <div key={m.id} className={`flex ${m.sender === 'visitor' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] rounded-2xl px-3.5 py-2 text-sm ${
                  m.sender === 'visitor'
                    ? 'bg-brand-500 text-white'
                    : m.sender === 'agent'
                    ? 'bg-action-50 dark:bg-action-900/30 text-ink-800 dark:text-ink-100'
                    : 'bg-ink-100 dark:bg-ink-700 text-ink-800 dark:text-ink-100'
                }`}>
                  {m.content}
                </div>
              </div>
            ))}
            {sending && (
              <div className="flex justify-start">
                <div className="rounded-2xl bg-ink-100 dark:bg-ink-700 px-3.5 py-2 text-sm text-ink-400 dark:text-ink-500">…</div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {status !== 'closed' && (
            <div className="border-t border-ink-100 dark:border-ink-800 p-3">
              {status === 'ai' && (
                <button onClick={requestHuman} className="mb-2 w-full rounded-lg border border-ink-200 dark:border-ink-700 py-1.5 text-xs font-semibold text-ink-600 dark:text-ink-300 transition hover:border-brand-300 hover:text-brand-600">
                  <Headset size={12} className="mr-1 inline" /> Parler à un membre de l'équipe
                </button>
              )}
              <div className="flex items-center gap-2">
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') send(); }}
                  placeholder="Écrivez votre message…"
                  className="input flex-1 py-2 text-sm"
                />
                <button onClick={send} disabled={sending || !input.trim()} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-500 text-white transition hover:bg-brand-600 disabled:opacity-40">
                  <Send size={15} />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}
