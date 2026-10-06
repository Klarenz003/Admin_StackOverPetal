-- Deploy before the matching admin release. Does not reset or delete any existing card.
begin;
create schema if not exists gift_qr_private;
revoke all on schema gift_qr_private from public, anon, authenticated;
create table if not exists gift_qr_private.action_log (
  session_id uuid primary key,
  actor_id uuid not null,
  qr_id uuid not null,
  action text not null,
  performed_at timestamptz not null default now()
);
alter table gift_qr_private.action_log enable row level security;
revoke all on gift_qr_private.action_log from public, anon, authenticated;

-- Prevent bypassing password confirmation through direct REST mutations.
drop policy if exists "Gift QR mutations require owner confirmation" on public.letter_v2_qr_codes;
create policy "Gift QR mutations require owner confirmation" on public.letter_v2_qr_codes
  as restrictive for update to authenticated using (false) with check (false);
drop policy if exists "Gift QR deletions require owner confirmation" on public.letter_v2_qr_codes;
create policy "Gift QR deletions require owner confirmation" on public.letter_v2_qr_codes
  as restrictive for delete to authenticated using (false);
drop policy if exists "Gift letter deletion requires owner confirmation" on public.letters;
create policy "Gift letter deletion requires owner confirmation" on public.letters
  as restrictive for delete to anon, authenticated using (letter_v2_qr_id is null);

create or replace function public.manage_gift_qr(p_qr_id uuid, p_action text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare q public.letter_v2_qr_codes%rowtype; session_id uuid;
begin
  if auth.uid() is null or public.current_admin_market() is distinct from 'ALL' then
    raise exception 'Owner access required' using errcode = '42501';
  end if;
  if p_action is null or p_action not in ('reset','remove_letter','delete','revoke') then
    raise exception 'Invalid Gift QR action';
  end if;
  session_id := nullif(auth.jwt()->>'session_id','')::uuid;
  if session_id is null or not exists (
    select 1 from auth.sessions s where s.id=session_id and s.user_id=auth.uid()
  ) or not exists (
    select 1 from jsonb_array_elements(coalesce(auth.jwt()->'amr','[]'::jsonb)) a
    where a->>'method' = 'password'
      and (a->>'timestamp')::numeric between extract(epoch from now())-120 and extract(epoch from now())+5
  ) then
    raise exception 'Confirm your owner password again' using errcode = '42501';
  end if;
  select * into q from public.letter_v2_qr_codes where id=p_qr_id for update;
  if not found then raise exception 'Gift QR no longer exists'; end if;
  -- Never touch a checkout letter or an inconsistent unrelated letter link.
  if q.letter_id is not null and exists (
    select 1 from public.letters l where l.id=q.letter_id and l.letter_v2_qr_id is distinct from q.id
  ) then raise exception 'Gift QR letter link needs review'; end if;
  if p_action='reset' and (q.letter_id is not null or q.status not in ('unused','claimed')
    or exists(select 1 from public.letters l where l.letter_v2_qr_id=q.id)) then
    raise exception 'Only an unused or claimed card without a letter can be reset';
  end if;
  if p_action='remove_letter' and not exists(select 1 from public.letters l where l.letter_v2_qr_id=q.id) then
    raise exception 'This card has no letter to remove';
  end if;
  -- One successful action per freshly authenticated session, even across concurrent calls.
  insert into gift_qr_private.action_log(session_id,actor_id,qr_id,action)
    values(session_id,auth.uid(),q.id,p_action) on conflict do nothing;
  if not found then raise exception 'Confirm your owner password for each action' using errcode='42501'; end if;
  if p_action in ('remove_letter','delete') then
    update public.letter_v2_qr_codes set letter_id=null where id=q.id;
    -- Password credentials and remembered sessions cascade with the deleted letter.
    delete from public.letters where letter_v2_qr_id=q.id;
  end if;
  if p_action='delete' then
    delete from public.letter_v2_qr_codes where id=q.id;
  elsif p_action='revoke' then
    update public.letter_v2_qr_codes set status='revoked',revoked_at=now() where id=q.id;
  else
    update public.letter_v2_qr_codes set status='unused',letter_id=null,
      claimed_at=null,published_at=null,revoked_at=null where id=q.id;
  end if;
  return true;
end;
$$;
revoke all on function public.manage_gift_qr(uuid,text) from public, anon, authenticated;
grant execute on function public.manage_gift_qr(uuid,text) to authenticated;
notify pgrst, 'reload schema';
commit;
