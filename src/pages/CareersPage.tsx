import { useEffect, useState } from 'react';
import { MapPin, Briefcase, ArrowRight } from 'lucide-react';
import { FooterPageLayout } from '../components/FooterPageLayout';
import { supabase } from '../lib/supabase';
import type { JobPosting } from '../lib/types';

export function CareersPage() {
  const [jobs, setJobs] = useState<JobPosting[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { (async () => {
    const { data } = await supabase
      .from('job_postings')
      .select('*')
      .eq('published', true)
      .order('created_at', { ascending: false });
    setJobs((data as JobPosting[]) ?? []);
    setLoading(false);
  })(); }, []);

  return (
    <FooterPageLayout title="Carrières chez LIYHA GROUP">
      <p className="text-ink-600 dark:text-ink-300">Nous construisons l'avenir du commerce africain. Rejoignez une équipe passionnée, pluriculturelle et ambitieuse.</p>

      <section className="mt-8">
        <h2 className="text-xl font-bold text-ink-900 dark:text-ink-50">Notre culture</h2>
        <p>Chez LIYHA GROUP, nous croyons que les meilleures solutions naissent de la diversité. Notre équipe réunit des talents du Cameroun, du Sénégal, du Nigeria et d'ailleurs, unis par une mission commune : doter chaque commerçant africain d'outils de classe internationale. Nous favorisons l'autonomie, la prise d'initiative et l'apprentissage continu.</p>
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-bold text-ink-900 dark:text-ink-50">Postes ouverts</h2>
        <div className="mt-4 space-y-4">
          {loading && [0, 1].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-2xl bg-ink-100 dark:bg-ink-800" />
          ))}
          {!loading && jobs.length === 0 && (
            <p className="text-ink-500 dark:text-ink-400">Aucun poste ouvert pour le moment. N'hésitez pas à nous envoyer votre candidature spontanée à <a href="mailto:careers@liyha.group" className="text-brand-600 hover:underline">careers@liyha.group</a>.</p>
          )}
          {!loading && jobs.map((j) => (
            <div key={j.id} className="rounded-2xl border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-800 p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="text-base font-bold text-ink-900 dark:text-ink-50">{j.title}</h3>
                  <div className="mt-1 flex flex-wrap gap-3 text-xs text-ink-500 dark:text-ink-400">
                    {j.department && <span className="inline-flex items-center gap-1"><Briefcase size={12} /> {j.department}</span>}
                    {j.location && <span className="inline-flex items-center gap-1"><MapPin size={12} /> {j.location}</span>}
                    <span className="rounded-full bg-brand-50 px-2 py-0.5 font-semibold text-brand-700">{j.type}</span>
                  </div>
                  <p className="mt-2 text-sm text-ink-600 dark:text-ink-300">{j.description.slice(0, 180)}{j.description.length > 180 ? '...' : ''}</p>
                </div>
                <a href={`mailto:careers@liyha.group?subject=Candidature - ${encodeURIComponent(j.title)}`} className="btn-ghost shrink-0">
                  Postuler <ArrowRight size={14} />
                </a>
              </div>
            </div>
          ))}
        </div>
      </section>
    </FooterPageLayout>
  );
}
