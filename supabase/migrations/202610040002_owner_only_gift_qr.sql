-- Gift QR management is owner-only; customer claim/resolve RPCs remain unchanged.
begin;
alter table public.letter_v2_qr_codes enable row level security;
drop policy if exists "Admins manage LetterPage V2 QR codes" on public.letter_v2_qr_codes;
drop policy if exists "Owner manages Gift QR codes" on public.letter_v2_qr_codes;
create policy "Owner manages Gift QR codes" on public.letter_v2_qr_codes
  for all to authenticated
  using (public.current_admin_market() = 'ALL')
  with check (public.current_admin_market() = 'ALL');

-- Prevent any other permissive policy from granting staff direct management access.
drop policy if exists "Gift QR owner access boundary" on public.letter_v2_qr_codes;
create policy "Gift QR owner access boundary" on public.letter_v2_qr_codes
  as restrictive for all to authenticated
  using (public.current_admin_market() = 'ALL')
  with check (public.current_admin_market() = 'ALL');
commit;
