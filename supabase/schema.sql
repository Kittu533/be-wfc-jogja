create table if not exists public.admin_places (
  id text primary key,
  slug text not null unique,
  name text not null,
  area text not null default '',
  category text not null default 'coffee_shop',
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  image_status text not null default 'missing' check (image_status in ('missing', 'fallback', 'scraped', 'uploaded')),
  updated_at timestamptz not null default now(),
  payload jsonb not null
);

create index if not exists admin_places_status_idx on public.admin_places (status);
create index if not exists admin_places_image_status_idx on public.admin_places (image_status);
create index if not exists admin_places_area_idx on public.admin_places (area);
create index if not exists admin_places_category_idx on public.admin_places (category);
create index if not exists admin_places_updated_at_idx on public.admin_places (updated_at desc);
create index if not exists admin_places_payload_gin_idx on public.admin_places using gin (payload);

alter table public.admin_places enable row level security;

drop policy if exists "Public can read published places" on public.admin_places;
create policy "Public can read published places"
on public.admin_places
for select
using (
  status = 'published'
  and image_status in ('scraped', 'uploaded')
);

grant select on public.admin_places to anon;
grant select on public.admin_places to authenticated;
grant select, insert, update, delete on public.admin_places to service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'place-images',
  'place-images',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Public can read place images" on storage.objects;
create policy "Public can read place images"
on storage.objects
for select
using (bucket_id = 'place-images');
