import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Calendar, ArrowRight } from 'lucide-react';
import { FooterPageLayout } from '../components/FooterPageLayout';
import { supabase } from '../lib/supabase';
import type { BlogPost } from '../lib/types';

export function BlogPage() {
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { (async () => {
    const { data } = await supabase
      .from('blog_posts')
      .select('id, title, slug, excerpt, author, published_at')
      .eq('published', true)
      .order('published_at', { ascending: false });
    setPosts((data as BlogPost[]) ?? []);
    setLoading(false);
  })(); }, []);

  return (
    <FooterPageLayout title="Blog LiAfrik Flow">
      <p className="text-ink-600">Conseils, analyses et actualités sur la gestion commerciale en Afrique.</p>

      <div className="mt-8 grid gap-6 sm:grid-cols-2">
        {loading && [0, 1].map((i) => (
          <div key={i} className="h-48 animate-pulse rounded-2xl bg-ink-100" />
        ))}
        {!loading && posts.length === 0 && (
          <p className="text-ink-500">Aucun article pour le moment.</p>
        )}
        {!loading && posts.map((p) => (
          <Link
            key={p.id}
            to={`/blog/${p.slug}`}
            className="group rounded-2xl border border-ink-200 bg-white p-6 transition hover:border-brand-200 hover:shadow-soft"
          >
            <div className="mb-3 flex items-center gap-2 text-xs text-ink-500">
              <Calendar size={13} />
              {p.published_at ? new Date(p.published_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : ''}
              · {p.author}
            </div>
            <h2 className="text-lg font-bold text-ink-900 group-hover:text-brand-600">{p.title}</h2>
            {p.excerpt && <p className="mt-2 text-sm text-ink-600 line-clamp-3">{p.excerpt}</p>}
            <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-brand-600">
              Lire l'article <ArrowRight size={14} className="transition group-hover:translate-x-0.5" />
            </span>
          </Link>
        ))}
      </div>
    </FooterPageLayout>
  );
}
