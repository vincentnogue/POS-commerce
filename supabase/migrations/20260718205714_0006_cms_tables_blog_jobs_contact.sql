/*
# CMS tables for Super Admin-managed content
# Blog posts, job postings, contact messages, and editable page content.
*/

create table if not exists public.blog_posts (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text unique not null,
  excerpt text,
  content text not null,
  author text not null default 'LIYHA GROUP',
  cover_url text,
  published boolean not null default false,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.job_postings (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  department text,
  location text,
  type text not null default 'full-time',
  description text not null,
  requirements text,
  salary_range text,
  published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.contact_messages (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  subject text,
  message text not null,
  handled boolean not null default false,
  created_at timestamptz not null default now()
);

-- RLS
alter table public.blog_posts enable row level security;
alter table public.job_postings enable row level security;
alter table public.contact_messages enable row level security;

-- Blog: public can read published, super_admin can manage all
drop policy if exists "blog_select_published" on public.blog_posts;
create policy "blog_select_published" on public.blog_posts for select
  to anon, authenticated using (published = true or public.is_super_admin(auth.uid()));

drop policy if exists "blog_insert_super" on public.blog_posts;
create policy "blog_insert_super" on public.blog_posts for insert
  to authenticated with check (public.is_super_admin(auth.uid()));

drop policy if exists "blog_update_super" on public.blog_posts;
create policy "blog_update_super" on public.blog_posts for update
  to authenticated using (public.is_super_admin(auth.uid())) with check (public.is_super_admin(auth.uid()));

drop policy if exists "blog_delete_super" on public.blog_posts;
create policy "blog_delete_super" on public.blog_posts for delete
  to authenticated using (public.is_super_admin(auth.uid()));

-- Jobs: public can read published, super_admin can manage all
drop policy if exists "jobs_select_published" on public.job_postings;
create policy "jobs_select_published" on public.job_postings for select
  to anon, authenticated using (published = true or public.is_super_admin(auth.uid()));

drop policy if exists "jobs_insert_super" on public.job_postings;
create policy "jobs_insert_super" on public.job_postings for insert
  to authenticated with check (public.is_super_admin(auth.uid()));

drop policy if exists "jobs_update_super" on public.job_postings;
create policy "jobs_update_super" on public.job_postings for update
  to authenticated using (public.is_super_admin(auth.uid())) with check (public.is_super_admin(auth.uid()));

drop policy if exists "jobs_delete_super" on public.job_postings;
create policy "jobs_delete_super" on public.job_postings for delete
  to authenticated using (public.is_super_admin(auth.uid()));

-- Contact messages: anyone can submit, only super_admin can read/handle
drop policy if exists "contact_insert_any" on public.contact_messages;
create policy "contact_insert_any" on public.contact_messages for insert
  to anon, authenticated with check (true);

drop policy if exists "contact_select_super" on public.contact_messages;
create policy "contact_select_super" on public.contact_messages for select
  to authenticated using (public.is_super_admin(auth.uid()));

drop policy if exists "contact_update_super" on public.contact_messages;
create policy "contact_update_super" on public.contact_messages for update
  to authenticated using (public.is_super_admin(auth.uid())) with check (public.is_super_admin(auth.uid()));

drop policy if exists "contact_delete_super" on public.contact_messages;
create policy "contact_delete_super" on public.contact_messages for delete
  to authenticated using (public.is_super_admin(auth.uid()));

-- Seed: 2 example blog posts
insert into public.blog_posts (title, slug, excerpt, content, author, published, published_at)
values
  ('Comment le Mobile Money transforme le commerce africain', 'mobile-money-transforme-commerce-africain',
   'Le Mobile Money est devenu le pilier des transactions commerciales en Afrique. Découvrez comment l''intégrer dans votre gestion.',
   'En 2026, plus de 60% des transactions commerciales en Afrique subsaharienne passent par le Mobile Money. Pour un commerçant, ne pas proposer ce moyen de paiement revient à se priver d''une part massive de clients. LiAfrik Flow intègre nativement Orange Money, MTN Mobile Money, Wave et M-Pesa pour permettre à vos vendeurs d''encaisser sans friction.\n\nL''avantage principal est la traçabilité : chaque transaction Mobile Money est automatiquement rattachée à une vente dans votre tableau de bord, avec recalcul du stock en temps réel. Fini les écarts de caisse liés aux encaissements manuels.',
   'LIYHA GROUP', true, now()),
  ('Multi-magasins : comment structurer votre expansion', 'multi-magasins-structurer-expansion',
   'Passer d''un seul magasin à plusieurs points de vente est un cap difficile. Voici la méthode.',
   'L''expansion multi-magasins est le défi numéro 1 des commerçants africains en croissance. Le risque principal est la perte de visibilité sur le stock : sans centralisation, impossible de savoir ce qui se vend réellement dans chaque point de vente.\n\nLiAfrik Flow résout ce problème avec un inventaire consolidé par produit et par magasin. Vous pouvez transférer du stock entre magasins, comparer les performances, et identifier les best-sellers par zone géographique.',
   'LIYHA GROUP', true, now())
on conflict (slug) do nothing;

-- Seed: 2 example job postings
insert into public.job_postings (title, department, location, type, description, requirements, salary_range, published)
values
  ('Ingénieur Full-Stack', 'Technologie', 'Yaoundé, Cameroun (ou remote)', 'full-time',
   'Rejoignez l''équipe LiAfrik Flow pour construire la plateforme de gestion commerciale n°1 en Afrique. Vous travaillerez sur React, TypeScript, Supabase et des architectures offline-first.',
   '3+ ans en React/TypeScript. Expérience avec PostgreSQL. Intérêt pour les produits B2B SaaS.',
   'Competitive + equity', true),
  ('Responsable Commercial Afrique Francophone', 'Commercial', 'Dakar, Sénégal', 'full-time',
   'Pilotez le développement commercial de LiAfrik Flow en Afrique francophone. Vous serez en charge de la prospection, du suivi clients et du déploiement sur le terrain.',
   '5+ ans en vente B2B SaaS. Maîtrise du français. Connaissance du tissu commercial africain.',
   'Competitive + commission', true)
on conflict do nothing;