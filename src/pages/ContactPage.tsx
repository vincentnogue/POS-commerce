import { useState } from 'react';
import { Mail, MapPin, Send, CheckCircle2 } from 'lucide-react';
import { FooterPageLayout } from '../components/FooterPageLayout';
import { supabase } from '../lib/supabase';

export function ContactPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!name.trim() || !email.trim() || !message.trim()) {
      setError('Veuillez remplir tous les champs obligatoires.');
      return;
    }
    setSending(true);
    setError(null);
    const { error: e } = await supabase.from('contact_messages').insert({
      name: name.trim(),
      email: email.trim(),
      subject: subject.trim() || null,
      message: message.trim(),
    });
    setSending(false);
    if (e) { setError(e.message); return; }
    setSent(true);
    setName(''); setEmail(''); setSubject(''); setMessage('');
  };

  return (
    <FooterPageLayout title="Contactez-nous">
      <p className="text-ink-600 dark:text-ink-300">Une question, un projet, une demande de démo ? Notre équipe vous répond sous 24h.</p>

      <div className="mt-8 grid gap-8 lg:grid-cols-2">
        {/* Contact form */}
        <div className="rounded-2xl border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-800 p-6">
          {sent ? (
            <div className="flex flex-col items-center py-8 text-center">
              <CheckCircle2 size={40} className="text-success-600" />
              <p className="mt-4 text-lg font-semibold text-ink-900 dark:text-ink-50">Message envoyé !</p>
              <p className="mt-1 text-sm text-ink-500 dark:text-ink-400">Nous vous répondrons sous 24h.</p>
              <button onClick={() => setSent(false)} className="btn-ghost mt-4">Envoyer un autre message</button>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="label">Nom complet *</label>
                <input value={name} onChange={(e) => setName(e.target.value)} className="input" placeholder="Votre nom" />
              </div>
              <div>
                <label className="label">Email *</label>
                <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" className="input" placeholder="vous@exemple.com" />
              </div>
              <div>
                <label className="label">Sujet</label>
                <input value={subject} onChange={(e) => setSubject(e.target.value)} className="input" placeholder="Objet de votre message" />
              </div>
              <div>
                <label className="label">Message *</label>
                <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={5} className="input resize-none" placeholder="Votre message..." />
              </div>
              {error && <p className="text-sm text-error-600">{error}</p>}
              <button onClick={submit} disabled={sending} className="btn-primary w-full justify-center">
                {sending ? 'Envoi...' : 'Envoyer'} <Send size={16} />
              </button>
            </div>
          )}
        </div>

        {/* Contact info */}
        <div className="space-y-6">
          <div className="rounded-2xl border border-ink-200 dark:border-ink-700 bg-brand-50/30 p-6">
            <MapPin className="mb-2 text-brand-600" size={20} />
            <h3 className="text-base font-bold text-ink-900 dark:text-ink-50">Bureau opérationnel</h3>
            <p className="mt-1 text-sm text-ink-600 dark:text-ink-300">Yaoundé-Soa, Cameroun<br />Centre, Cameroun</p>
          </div>
          <div className="rounded-2xl border border-ink-200 dark:border-ink-700 bg-brand-50/30 p-6">
            <MapPin className="mb-2 text-brand-600" size={20} />
            <h3 className="text-base font-bold text-ink-900 dark:text-ink-50">Siège social</h3>
            <p className="mt-1 text-sm text-ink-600 dark:text-ink-300">Dubaï, Émirats arabes unis</p>
          </div>
          <div className="rounded-2xl border border-ink-200 dark:border-ink-700 bg-brand-50/30 p-6">
            <Mail className="mb-2 text-brand-600" size={20} />
            <h3 className="text-base font-bold text-ink-900 dark:text-ink-50">Email</h3>
            <p className="mt-1 text-sm text-ink-600 dark:text-ink-300">
              <a href="mailto:contact@liyha.group" className="hover:text-brand-600">contact@liyha.group</a><br />
              <a href="mailto:support@liyha.group" className="hover:text-brand-600">support@liyha.group</a>
            </p>
          </div>
        </div>
      </div>
    </FooterPageLayout>
  );
}
