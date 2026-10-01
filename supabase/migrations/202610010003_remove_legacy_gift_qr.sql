-- Destructive cleanup of the retired checkout Gift QR product.
-- This does NOT touch letter_v2_qr_codes or LetterPage V2 letters.
-- Existing letters remain; only their legacy gift_qr_id link is removed.

drop function if exists public.create_gift_letter(text, text, text, text, text, jsonb);
drop function if exists public.publish_gift_qr(text, uuid);
drop function if exists public.claim_gift_qr(text, text);
drop function if exists public.resolve_gift_qr(text);

alter table if exists public.letters
  drop column if exists gift_qr_id;

drop table if exists public.gift_qr_codes;
