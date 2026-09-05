-- BUG FIX: every "Read more" link on /blog pointed at /blog/:slug, but
-- that route never existed anywhere in App.tsx — clicking any blog post
-- was a dead link (silently caught by the app's catch-all/redirect).
-- BlogPostPage.tsx (added alongside this migration) is the real detail
-- page; these two columns let each post carry its own SEO title/
-- description instead of always falling back to the post's own
-- title/excerpt (a reasonable default, but a real CMS lets an editor
-- write copy specifically tuned for a search snippet, which is often
-- shorter/punchier than the article's own opening paragraph).
alter table public.blog_posts
  add column if not exists meta_title text,
  add column if not exists meta_description text;
