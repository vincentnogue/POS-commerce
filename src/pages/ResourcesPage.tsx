import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft, ArrowRight, BookOpen, LifeBuoy, Newspaper, Code2,
  MessageCircle, PlayCircle, Sun, Moon, Calendar,
} from 'lucide-react';
import { Logo } from '../components/Logo';
import { useI18n } from '../lib/i18n';
import { useDocumentMeta } from '../lib/useDocumentMeta';
import { useTheme } from '../lib/theme';
import { supabase } from '../lib/supabase';
import type { BlogPost } from '../lib/types';

// Real hub page tying together the resource destinations that already
// exist in this app (Documentation, Help Center, Blog, Contact) — before
// this page existed, "Resources" in the header was only a dropdown with
// no single landing destination of its own.
const RESOURCE_CARDS = [
  {
    icon: BookOpen,
    titleKey: 'resources.cards.docs.title',
    descKey: 'resources.cards.docs.desc',
    href: '/documentation',
  },
  {
    icon: LifeBuoy,
    titleKey: 'resources.cards.help.title',
    descKey: 'resources.cards.help.desc',
    href: '/help',
  },
  {
    icon: Newspaper,
    titleKey: 'resources.cards.blog.title',
    descKey: 'resources.cards.blog.desc',
    href: '/blog',
  },
  {
    icon: Code2,
    titleKey: 'resources.cards.api.title',
    descKey: 'resources.cards.api.desc',
    href: '/documentation',
  },
  {
    icon: MessageCircle,
    titleKey: 'resources.cards.contact.title',
    descKey: 'resources.cards.contact.desc',
    href: '/contact',
  },
  {
    icon: PlayCircle,
    titleKey: 'resources.cards.gettingStarted.title',
    descKey: 'resources.cards.gettingStarted.desc',
    href: '/documentation',
  },
];

export function ResourcesPage() {
  const { t, lang } = useI18n();
  useDocumentMeta(t('seo.resources.title'), t('seo.resources.desc'));
  const { theme, toggle } = useTheme();
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('blog_posts')
        .select('id, title, slug, excerpt, author, published_at')
        .eq('published', true)
        .order('published_at', { ascending: false })
        .limit(3);
      setPosts((data as BlogPost[]) ?? []);
      setLoading(false);
    })();
  }, []);

  return (
    <div className="min-h-screen bg-white dark:bg-ink-950">
      <header className="sticky top-0 z-30 border-b border-ink-100 dark:border-ink-800 bg-white/85 dark:bg-ink-950/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3.5 lg:px-8">
          <Link to="/"><Logo /></Link>
          <div className="flex items-center gap-3">
            <Link to="/" className="inline-flex items-center gap-1 text-sm font-medium text-ink-600 dark:text-ink-300 hover:text-brand-600">
              <ArrowLeft size={14} /> {t('pricing.backHome')}
            </Link>
            <button
              onClick={toggle}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-ink-200 dark:border-ink-700 text-ink-600 dark:text-ink-300 transition hover:border-brand-200 hover:text-brand-600"
              aria-label={t('header.toggleTheme')}
            >
              {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
            </button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <div className="bg-gradient-to-r from-brand-600 to-flow-600 py-16">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h1 className="text-4xl font-bold text-white mb-4">{t('resources.title')}</h1>
          <p className="text-xl text-white/90">{t('resources.subtitle')}</p>
        </div>
      </div>

      {/* Resource cards grid */}
      <div className="max-w-6xl mx-auto px-4 lg:px-8 py-16">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {RESOURCE_CARDS.map((card) => (
            <Link
              key={card.titleKey}
              to={card.href}
              className="group rounded-2xl border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900 p-6 transition hover:border-brand-300 dark:hover:border-brand-500/50 hover:shadow-lg"
            >
              <div className="w-11 h-11 rounded-lg bg-brand-500/10 flex items-center justify-center mb-4">
                <card.icon className="w-5 h-5 text-brand-600 dark:text-brand-400" />
              </div>
              <h3 className="font-semibold text-ink-900 dark:text-ink-50 mb-2">{t(card.titleKey)}</h3>
              <p className="text-sm text-ink-600 dark:text-ink-300 leading-relaxed">{t(card.descKey)}</p>
              <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-brand-600 dark:text-brand-400">
                {t('resources.explore')} <ArrowRight size={14} className="transition group-hover:translate-x-0.5" />
              </span>
            </Link>
          ))}
        </div>

        {/* Latest from the blog */}
        <div className="mt-16">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-ink-900 dark:text-white">{t('resources.latestPosts')}</h2>
            <Link to="/blog" className="text-sm font-medium text-brand-600 dark:text-brand-400 hover:text-brand-500 inline-flex items-center gap-1">
              {t('resources.viewAllPosts')} <ArrowRight size={14} />
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {loading && [0, 1, 2].map((i) => (
              <div key={i} className="h-40 animate-pulse rounded-2xl bg-ink-100 dark:bg-ink-800" />
            ))}
            {!loading && posts.length === 0 && (
              <p className="text-ink-500 dark:text-ink-400 sm:col-span-3">{t('blog.empty')}</p>
            )}
            {!loading && posts.map((p) => (
              <Link
                key={p.id}
                to={`/blog/${p.slug}`}
                className="group rounded-2xl border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900 p-5 transition hover:border-brand-200 hover:shadow-soft"
              >
                <div className="mb-2 flex items-center gap-2 text-xs text-ink-500 dark:text-ink-400">
                  <Calendar size={12} />
                  {p.published_at
                    ? new Date(p.published_at).toLocaleDateString(lang === 'en' ? 'en-US' : 'fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
                    : ''}
                </div>
                <h3 className="text-sm font-semibold text-ink-900 dark:text-ink-50 group-hover:text-brand-600 line-clamp-2">{p.title}</h3>
              </Link>
            ))}
          </div>
        </div>

        {/* Support CTA */}
        <div className="mt-16 rounded-2xl bg-gradient-to-r from-brand-500/10 to-flow-500/10 border border-brand-500/30 p-8 text-center">
          <h2 className="text-xl font-bold text-ink-900 dark:text-white mb-2">{t('resources.ctaTitle')}</h2>
          <p className="text-ink-600 dark:text-ink-300 mb-6">{t('resources.ctaDesc')}</p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link to="/help" className="px-6 py-3 rounded-full bg-brand-600 text-white font-semibold hover:bg-brand-700 transition">
              {t('resources.ctaHelp')}
            </Link>
            <Link to="/contact" className="px-6 py-3 rounded-full border border-ink-200 dark:border-ink-700 text-ink-700 dark:text-ink-200 font-semibold hover:border-brand-300 transition">
              {t('resources.ctaContact')}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
