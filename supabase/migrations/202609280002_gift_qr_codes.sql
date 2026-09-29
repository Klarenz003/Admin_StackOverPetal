create extension if not exists pgcrypto;

create table if not exists public.gift_qr_codes (
  id uuid primary key default gen_random_uuid(),
  public_token text not null unique,
  activation_code text not null,
  product_name text not null default 'Stack Petals gift',
  has_360_view boolean not null default false,
  has_photo_upload boolean not null default true,
  status text not null default 'unused' check (status in ('unused', 'claimed', 'published', 'revoked', 'replaced')),
  letter_id uuid,
  created_by uuid references auth.users(id) on delete set null,
  claimed_at timestamptz,
  published_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists gift_qr_codes_status_idx on public.gift_qr_codes(status);
create index if not exists gift_qr_codes_product_idx on public.gift_qr_codes(product_name);

alter table public.gift_qr_codes add column if not exists has_photo_upload boolean not null default true;

alter table if exists public.letters
  add column if not exists gift_qr_id uuid references public.gift_qr_codes(id) on delete set null;

do $$
begin
  if to_regclass('public.letters') is not null then
    alter table public.gift_qr_codes
      add constraint gift_qr_codes_letter_id_fkey foreign key (letter_id)
      references public.letters(id) on delete set null;
  end if;
exception when duplicate_object then null;
end;
$$;

alter table public.gift_qr_codes enable row level security;
drop policy if exists "Admins manage gift QR codes" on public.gift_qr_codes;
create policy "Admins manage gift QR codes"
  on public.gift_qr_codes for all to authenticated
  using (public.is_investor_admin())
  with check (public.is_investor_admin());

create or replace function public.resolve_gift_qr(p_public_token text)
returns table (id uuid, product_name text, has_360_view boolean, has_photo_upload boolean, status text, letter_id uuid)
language sql security definer stable set search_path = public
as $$
  select id, product_name, has_360_view, has_photo_upload, status, letter_id
  from public.gift_qr_codes
  where public_token = trim(p_public_token)
    and status in ('unused', 'claimed', 'published');
$$;
revoke all on function public.resolve_gift_qr(text) from public;
grant execute on function public.resolve_gift_qr(text) to anon, authenticated;

create or replace function public.claim_gift_qr(p_public_token text, p_activation_code text default null)
returns table (id uuid, product_name text, has_360_view boolean, has_photo_upload boolean, status text, letter_id uuid)
language plpgsql security definer set search_path = public
as $$
begin
  return query
  update public.gift_qr_codes q
     set status = case when q.status = 'unused' then 'claimed' else q.status end,
         claimed_at = coalesce(q.claimed_at, now())
   where q.public_token = trim(p_public_token)
     and q.status in ('unused', 'claimed')
     and (nullif(trim(coalesce(p_activation_code, '')), '') is null
          or q.activation_code = upper(trim(p_activation_code)))
  returning q.id, q.product_name, q.has_360_view, q.has_photo_upload, q.status, q.letter_id;
end;
$$;
revoke all on function public.claim_gift_qr(text, text) from public;
grant execute on function public.claim_gift_qr(text, text) to anon, authenticated;

create or replace function public.publish_gift_qr(p_public_token text, p_letter_id uuid)
returns boolean
language sql security definer set search_path = public
as $$
  update public.gift_qr_codes
     set letter_id = p_letter_id, status = 'published', published_at = now()
   where public_token = trim(p_public_token) and status in ('claimed', 'published')
  returning true;
$$;
revoke all on function public.publish_gift_qr(text, uuid) from public;
grant execute on function public.publish_gift_qr(text, uuid) to anon, authenticated;
