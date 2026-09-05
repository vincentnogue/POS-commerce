import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Calendar, ArrowLeft } from 'lucide-react';
import { FooterPageLayout } from '../components/FooterPageLayout';
import { supabase } from '../lib/supabase';
import type { BlogPost } from '../lib/types';
import { useI18n } from '../lib/i18n';
import { useDocumentMeta } from '../lib/useDocumentMeta';

// BUG FIX: /blog/:slug never had a route — every "Read more" link on
// /blog was dead. This is that missing page, with real per-article SEO
// (title/description/OG image) instead of the site-wide generic tags
// every route was stuck with before useDocumentMeta existed.
export function BlogPostPage() {
  const { slug } = useParams<{ slug: string }>();
  const { t, lang } = useI18n();
  const [post, setPost] = useState<BlogPost | null | 'loading'>('loading');

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('blog_posts')
        .select('*')
        .eq('slug', slug)
        .eq('published', true)
        .maybeSingle();
      if (!cancelled) setPost((data as BlogPost) ?? null);
    })();
    return () => { cancelled = true; };
  }, [slug]);

  const seoTitle = post && post !== 'loading' ? (post.meta_title || post.title) : t('seo.blog.title');
  const seoDesc = post && post !== 'loading' ? (post.meta_description || post.excerpt || undefined) : t('seo.blog.desc');
  useDocumentMeta(seoTitle, seoDesc, {
    image: post && post !== 'loading' ? (post.cover_url ?? undefined) : undefined,
    url: slug ? `https://pos.liafrik.com/blog/${slug}` : undefined,
    type: 'article',
  });

  if (post === 'loading') {
    return (
      <FooterPageLayout title="">
        <div className="h-8 w-2/3 animate-pulse rounded bg-ink-100 dark:bg-ink-800" />
        <div className="mt-4 h-48 animate-pulse rounded-2xl bg-ink-100 dark:bg-ink-800" />
      </FooterPageLayout>
    );
  }

  if (!post) {
    return (
      <FooterPageLayout title={t('blog.notFound.title')}>
        <p className="text-ink-600 dark:text-ink-300">{t('blog.notFound.desc')}</p>
        <Link to="/blog" className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-brand-600 hover:underline">
          <ArrowLeft size={14} /> {t('blog.backToList')}
        </Link>
      </FooterPageLayout>
    );
  }

  return (
    <FooterPageLayout title={post.title}>
      <Link to="/blog" className="mb-2 inline-flex items-center gap-1.5 text-sm font-medium text-brand-600 hover:underline">
        <ArrowLeft size={14} /> {t('blog.backToList')}
      </Link>

      <div className="mb-6 flex items-center gap-2 text-sm text-ink-500 dark:text-ink-400">
        <Calendar size={14} />
        {post.published_at ? new Date(post.published_at).toLocaleDateString(lang === 'en' ? 'en-US' : 'fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : ''}
        · {post.author}
      </div>

      {post.cover_url && (
        <img src={post.cover_url} alt="" className="mb-8 w-full rounded-2xl border border-ink-200 object-cover dark:border-ink-700" style={{ maxHeight: 420 }} />
      )}

      <div className="prose prose-ink max-w-none dark:prose-invert">
        {post.content.split(/\n{2,}/).map((paragraph, i) => (
          <p key={i} className="mb-4 whitespace-pre-line leading-relaxed text-ink-700 dark:text-ink-200">{paragraph}</p>
        ))}
      </div>
    </FooterPageLayout>
  );
}
