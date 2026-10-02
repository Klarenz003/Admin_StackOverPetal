-- Keep customer letters created through Gift QR codes separate from checkout/order letters in admin.
-- The storefront already owns this relationship; this migration makes it available to the admin project too.
alter table if exists public.letters
  add column if not exists letter_v2_qr_id uuid references public.letter_v2_qr_codes(id) on delete set null;

create index if not exists letters_letter_v2_qr_id_idx
  on public.letters(letter_v2_qr_id)
  where letter_v2_qr_id is not null;
