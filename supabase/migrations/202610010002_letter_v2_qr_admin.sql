-- Admin-side schema for the standalone LetterPage V2 QR product.
-- The storefront migration owns the public claim/create RPCs.
create extension if not exists pgcrypto;

create table if not exists public.letter_v2_qr_codes (
  id uuid primary key default gen_random_uuid(),
  public_token text not null unique,
  activation_code text not null,
  product_name text not null default 'LetterPage V2',
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
alter table public.letter_v2_qr_codes add column if not exists has_photo_upload boolean not null default true;
create index if not exists letter_v2_qr_codes_status_idx on public.letter_v2_qr_codes(status);
alter table public.letter_v2_qr_codes enable row level security;
drop policy if exists "Admins manage LetterPage V2 QR codes" on public.letter_v2_qr_codes;
create policy "Admins manage LetterPage V2 QR codes" on public.letter_v2_qr_codes
  for all to authenticated using (public.is_investor_admin()) with check (public.is_investor_admin());
