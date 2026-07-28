import { useState } from 'react';
import { Mail, MapPin, Send, CheckCircle2 } from 'lucide-react';
import { FooterPageLayout } from '../components/FooterPageLayout';
import { supabase } from '../lib/supabase';
import { useI18n } from '../lib/i18n';

export function ContactPage() {
  const { t } = useI18n();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!name.trim() || !email.trim() || !message.trim()) {
      setError(t('contact.form.requiredError'));
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
    // Best-effort email notification — the message is already safely saved
    // above regardless of whether this succeeds.
    fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-contact-notification`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name.trim(), email: email.trim(), subject: subject.trim(), message: message.trim() }),
    }).catch(() => {});
    setSent(true);
    setName(''); setEmail(''); setSubject(''); setMessage('');
  };

  return (
    <FooterPageLayout title={t('contact.title')}>
      <p className="text-ink-600 dark:text-ink-300">{t('contact.intro')}</p>

      <div className="mt-8 grid gap-8 lg:grid-cols-2">
        {/* Contact form */}
        <div className="rounded-2xl border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-800 p-6">
          {sent ? (
            <div className="flex flex-col items-center py-8 text-center">
              <CheckCircle2 size={40} className="text-success-600" />
              <p className="mt-4 text-lg font-semibold text-ink-900 dark:text-ink-50">{t('contact.sent.title')}</p>
              <p className="mt-1 text-sm text-ink-500 dark:text-ink-400">{t('contact.sent.text')}</p>
              <button onClick={() => setSent(false)} className="btn-ghost mt-4">{t('contact.sent.another')}</button>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="label">{t('contact.form.name')}</label>
                <input value={name} onChange={(e) => setName(e.target.value)} className="input" placeholder={t('contact.form.namePlaceholder')} />
              </div>
              <div>
                <label className="label">{t('contact.form.email')}</label>
                <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" className="input" placeholder="vous@exemple.com" />
              </div>
              <div>
                <label className="label">{t('contact.form.subject')}</label>
                <input value={subject} onChange={(e) => setSubject(e.target.value)} className="input" placeholder={t('contact.form.subjectPlaceholder')} />
              </div>
              <div>
                <label className="label">{t('contact.form.message')}</label>
                <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={5} className="input resize-none" placeholder={t('contact.form.messagePlaceholder')} />
              </div>
              {error && <p className="text-sm text-error-600">{error}</p>}
              <button onClick={submit} disabled={sending} className="btn-primary w-full justify-center">
                {sending ? t('contact.form.sending') : t('contact.form.send')} <Send size={16} />
              </button>
            </div>
          )}
        </div>

        {/* Contact info */}
        <div className="space-y-6">
          <div className="rounded-2xl border border-ink-200 dark:border-ink-700 bg-brand-50/30 dark:bg-brand-900/25 p-6">
            <MapPin className="mb-2 text-brand-600" size={20} />
            <h3 className="text-base font-bold text-ink-900 dark:text-ink-50">{t('contact.info.office')}</h3>
            <p className="mt-1 text-sm text-ink-600 dark:text-ink-300">{t('contact.info.officeValue')}</p>
          </div>
          <div className="rounded-2xl border border-ink-200 dark:border-ink-700 bg-brand-50/30 dark:bg-brand-900/25 p-6">
            <MapPin className="mb-2 text-brand-600" size={20} />
            <h3 className="text-base font-bold text-ink-900 dark:text-ink-50">{t('contact.info.hq')}</h3>
            <p className="mt-1 text-sm text-ink-600 dark:text-ink-300">{t('contact.info.hqValue')}</p>
          </div>
          <div className="rounded-2xl border border-ink-200 dark:border-ink-700 bg-brand-50/30 dark:bg-brand-900/25 p-6">
            <Mail className="mb-2 text-brand-600" size={20} />
            <h3 className="text-base font-bold text-ink-900 dark:text-ink-50">{t('contact.info.email')}</h3>
            <p className="mt-1 text-sm text-ink-600 dark:text-ink-300">
              <a href="mailto:cs@liafrik.com" className="hover:text-brand-600">cs@liafrik.com</a><br />
              <a href="mailto:support@liafrik.com" className="hover:text-brand-600">support@liafrik.com</a>
            </p>
          </div>
        </div>
      </div>
    </FooterPageLayout>
  );
}
