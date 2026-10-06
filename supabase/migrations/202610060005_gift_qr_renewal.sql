-- Apply after private gift letters and owner reactivation; before both app releases.
begin;
create or replace function public.manage_gift_qr(p_qr_id uuid, p_action text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare q public.letter_v2_qr_codes%rowtype; session_id uuid; restored_status text;
begin
  if auth.uid() is null or public.current_admin_market() is distinct from 'ALL' then
    raise exception 'Owner access required' using errcode = '42501';
  end if;
  if p_action is null or p_action not in ('reset','remove_letter','delete','revoke','reactivate') then
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
  if p_action='reactivate' then
    if q.status <> 'revoked' then raise exception 'Only a revoked QR can be reactivated'; end if;
    if q.letter_id is not null then
      if not exists(select 1 from public.letters l where l.id=q.letter_id and l.letter_v2_qr_id=q.id and l.published)
        or exists(select 1 from public.letters l where l.letter_v2_qr_id=q.id and l.id<>q.letter_id) then
        raise exception 'Gift QR letter link needs review';
      end if;
      -- A renewed card with a letter but no activation history must stay gated.
      restored_status := case when q.claimed_at is null and q.published_at is null then 'unused' else 'published' end;
    else
      if q.published_at is not null or exists(select 1 from public.letters l where l.letter_v2_qr_id=q.id) then
        raise exception 'Gift QR letter link needs review';
      end if;
      restored_status := case when q.claimed_at is not null then 'claimed' else 'unused' end;
    end if;
  end if;
  insert into gift_qr_private.action_log(session_id,actor_id,qr_id,action)
    values(session_id,auth.uid(),q.id,p_action) on conflict do nothing;
  if not found then raise exception 'Confirm your owner password for each action' using errcode='42501'; end if;
  if p_action in ('remove_letter','delete') then
    update public.letter_v2_qr_codes set letter_id=null where id=q.id;
    delete from public.letters where letter_v2_qr_id=q.id;
  end if;
  if p_action='delete' then
    delete from public.letter_v2_qr_codes where id=q.id;
  elsif p_action='revoke' then
    update public.letter_v2_qr_codes set status='revoked',revoked_at=now() where id=q.id;
  elsif p_action='reactivate' then
    -- Preserve letter/password/sessions, QR token, activation code and activation history.
    update public.letter_v2_qr_codes set status=restored_status,revoked_at=null where id=q.id;
  else
    update public.letter_v2_qr_codes set status='unused',letter_id=null,
      claimed_at=null,published_at=null,revoked_at=null where id=q.id;
  end if;
  return true;
end;
$$;
revoke all on function public.manage_gift_qr(uuid,text) from public, anon, authenticated;
grant execute on function public.manage_gift_qr(uuid,text) to authenticated;
alter table gift_qr_private.action_log add column if not exists new_qr_id uuid;
create or replace function public.renew_gift_qr(p_qr_id uuid)
returns uuid language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare q public.letter_v2_qr_codes%rowtype; new_id uuid; new_token text; new_code text;
begin
  if auth.uid() is null or public.current_admin_market() is distinct from 'ALL' then
    raise exception 'Owner access required' using errcode='42501';
  end if;
  select * into q from public.letter_v2_qr_codes where id=p_qr_id for update;
  if not found then raise exception 'Gift QR no longer exists'; end if;
  if q.status not in ('published','revoked') or q.letter_id is null then
    raise exception 'Renewal requires a published or revoked card with a letter';
  end if;
  perform 1 from public.letters l where l.id=q.letter_id and l.letter_v2_qr_id=q.id
    and l.published and l.requires_password for update;
  if not found or exists(select 1 from public.letters l where l.letter_v2_qr_id=q.id and l.id<>q.letter_id) then
    raise exception 'A valid password-protected Gift QR letter is required';
  end if;
  -- Reuse the server's owner, live session, fresh-password and single-action checks.
  perform public.manage_gift_qr(q.id,'revoke');
  new_token := encode(gen_random_bytes(18),'hex');
  new_code := upper(encode(gen_random_bytes(4),'hex'));
  new_code := substr(new_code,1,4)||'-'||substr(new_code,5,4);
  insert into public.letter_v2_qr_codes(public_token,activation_code,product_name,
    has_360_view,has_photo_upload,status,letter_id,created_by)
    values(new_token,new_code,q.product_name,q.has_360_view,q.has_photo_upload,'unused',q.letter_id,auth.uid())
    returning id into new_id;
  update public.letters set letter_v2_qr_id=new_id where id=q.letter_id;
  update public.letter_v2_qr_codes set status='replaced',letter_id=null,revoked_at=now() where id=q.id;
  update gift_qr_private.action_log set action='renew',new_qr_id=new_id
    where session_id=(auth.jwt()->>'session_id')::uuid;
  return new_id;
end;
$$;
revoke all on function public.renew_gift_qr(uuid) from public,anon,authenticated;
grant execute on function public.renew_gift_qr(uuid) to authenticated;

-- A renewed card already contains a letter: activation publishes its QR access,
-- not a second letter. Normal empty cards still open the composer as before.
create or replace function public.claim_letter_v2_qr(p_public_token text,p_activation_code text default null)
returns table (id uuid,product_name text,has_360_view boolean,has_photo_upload boolean,status text,letter_id uuid)
language sql security definer set search_path = '' as $$
  update public.letter_v2_qr_codes q
    set status=case when q.letter_id is not null then 'published' else 'claimed' end,
      claimed_at=coalesce(q.claimed_at,now()),
      published_at=case when q.letter_id is not null then coalesce(q.published_at,now()) else q.published_at end
    where q.public_token=trim(p_public_token) and q.status in ('unused','claimed')
      and q.activation_code=upper(trim(coalesce(p_activation_code,'')))
      and (q.letter_id is null or exists(select 1 from public.letters l
        where l.id=q.letter_id and l.letter_v2_qr_id=q.id and l.published))
    returning q.id,q.product_name,q.has_360_view,q.has_photo_upload,q.status,q.letter_id;
$$;
revoke all on function public.claim_letter_v2_qr(text,text) from public,anon,authenticated;
grant execute on function public.claim_letter_v2_qr(text,text) to anon,authenticated;
notify pgrst,'reload schema';
commit;
