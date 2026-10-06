// Isolated database only. Usage: node scripts/check-gift-qr-management.cjs <embedded-postgres package directory>
const { createRequire } = require('node:module')
const { pathToFileURL } = require('node:url')
const { join, resolve } = require('node:path')
const { readFileSync } = require('node:fs')
const { randomBytes, randomUUID } = require('node:crypto')
const assert = require('node:assert/strict')
;(async () => {
  if (!process.argv[2]) throw Error('Pass an isolated embedded-postgres package directory.')
  const root=resolve(process.argv[2]), req=createRequire(join(root,'package.json'))
  const { default: EmbeddedPostgres }=await import(pathToFileURL(req.resolve('embedded-postgres')).href)
  const db=new EmbeddedPostgres({ databaseDir:join(root,`qr-actions-${Date.now()}`),user:'postgres',password:randomBytes(24).toString('hex'),port:55440,persistent:true,createPostgresUser:false,postgresFlags:['-h','127.0.0.1'],onLog:()=>{},onError:()=>{} })
  let client
  try {
    await db.initialise(); await db.start(); client=db.getPgClient(); await client.connect()
    await client.query(`
      create role anon; create role authenticated; create schema auth; create schema extensions;
      create extension pgcrypto with schema extensions;
      create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb $$;
      create function auth.uid() returns uuid language sql stable as $$ select (auth.jwt()->>'sub')::uuid $$;
      create function public.current_admin_market() returns text language sql stable as $$ select auth.jwt()->>'admin_market' $$;
      create table auth.sessions(id uuid primary key,user_id uuid);
      create table public.letter_v2_qr_codes(id uuid primary key default gen_random_uuid(),public_token text unique,activation_code text,product_name text,has_360_view boolean default false,has_photo_upload boolean default true,created_by uuid,status text,letter_id uuid,claimed_at timestamptz,published_at timestamptz,revoked_at timestamptz);
      create table public.letters(id uuid primary key,letter_v2_qr_id uuid references public.letter_v2_qr_codes(id) on delete set null,published boolean default true,requires_password boolean default true);
      create table public.test_credentials(letter_id uuid primary key references public.letters(id) on delete cascade);
      create table public.test_sessions(letter_id uuid references public.test_credentials(letter_id) on delete cascade);
      alter table public.letters enable row level security;
      alter table public.letter_v2_qr_codes enable row level security;
      grant usage on schema public,auth to authenticated,anon;
      grant select,update,delete on public.letters,public.letter_v2_qr_codes to authenticated;
      create policy owner_qr on public.letter_v2_qr_codes for all to authenticated using(public.current_admin_market()='ALL') with check(public.current_admin_market()='ALL');
      create policy owner_letter on public.letters for all to authenticated using(public.current_admin_market()='ALL') with check(public.current_admin_market()='ALL');
    `)
    const migration=readFileSync('supabase/migrations/202610060003_gift_qr_owner_actions.sql','utf8')
    await client.query(migration); await client.query(migration)
    const reactivation=readFileSync('supabase/migrations/202610060004_gift_qr_reactivation.sql','utf8')
    await client.query(reactivation); await client.query(reactivation)
    const renewal=readFileSync('supabase/migrations/202610060005_gift_qr_renewal.sql','utf8')
    await client.query(renewal); await client.query(renewal)
    const owner=randomUUID(), card=randomUUID(), published=randomUUID(), letter=randomUUID(), checkout=randomUUID()
    await client.query(`insert into public.letter_v2_qr_codes(id,status,letter_id) values($1,'claimed',null),($2,'published',$3)`,[card,published,letter])
    await client.query('update public.letter_v2_qr_codes set claimed_at=now(),published_at=now() where id=$1',[published])
    await client.query(`insert into public.letters(id,letter_v2_qr_id) values($1,$2),($3,null)`,[letter,published,checkout])
    await client.query('insert into public.test_credentials values($1)',[letter])
    await client.query('insert into public.test_sessions values($1)',[letter])
    async function claims(market='ALL',age=0,method='password',active=true) {
      await client.query('reset role')
      const sid=randomUUID()
      if(active) await client.query('insert into auth.sessions values($1,$2)',[sid,owner])
      await client.query(`select set_config('request.jwt.claims',$1,false)`,[JSON.stringify({sub:owner,session_id:sid,admin_market:market,amr:[{method,timestamp:Math.floor(Date.now()/1000)-age}]})])
      await client.query('set role authenticated')
    }
    async function action(id,value) { return client.query('select public.manage_gift_qr($1,$2)',[id,value]) }
    await claims('PH'); await assert.rejects(action(card,'reset'),/Owner access required/)
    await claims('ALL',300); await assert.rejects(action(card,'reset'),/Confirm your owner password/)
    await claims('ALL',0,'otp'); await assert.rejects(action(card,'reset'),/Confirm your owner password/)
    await claims('ALL',0,'password',false); await assert.rejects(action(card,'reset'),/Confirm your owner password/)
    await claims(); await assert.rejects(action(card,'published'),/Invalid Gift QR action/)
    assert.equal((await client.query('update public.letter_v2_qr_codes set status=\'unused\' where id=$1',[card])).rowCount,0)
    assert.equal((await client.query('delete from public.letter_v2_qr_codes where id=$1',[published])).rowCount,0)
    assert.equal((await client.query('delete from public.letters where id=$1',[letter])).rowCount,0)
    await action(card,'reset'); await assert.rejects(action(card,'revoke'),/each action/)
    assert.equal((await client.query('select status from public.letter_v2_qr_codes where id=$1',[card])).rows[0].status,'unused')
    await claims(); await assert.rejects(action(published,'reset'),/without a letter/)
    await action(published,'revoke')
    assert.equal((await client.query('select id from public.letters where id=$1',[letter])).rowCount,1)
    await claims('PH'); await assert.rejects(action(published,'reactivate'),/Owner access required/)
    await claims('ALL',300); await assert.rejects(action(published,'reactivate'),/Confirm your owner password/)
    await claims(); await action(published,'reactivate')
    assert.deepEqual((await client.query('select status,letter_id,revoked_at from public.letter_v2_qr_codes where id=$1',[published])).rows[0],{status:'published',letter_id:letter,revoked_at:null})
    await assert.rejects(action(card,'revoke'),/each action/)
    await claims(); await assert.rejects(action(published,'reactivate'),/Only a revoked/)
    await client.query('reset role')
    assert.equal((await client.query('select * from public.test_credentials')).rowCount,1)
    assert.equal((await client.query('select * from public.test_sessions')).rowCount,1)
    const unopened=randomUUID(), unfinished=randomUUID(), missingLetter=randomUUID(), orphan=randomUUID()
    await client.query(`insert into public.letter_v2_qr_codes(id,status,claimed_at,letter_id) values($1,'revoked',null,null),($2,'revoked',now(),null),($3,'revoked',now(),$4)`,[unopened,unfinished,orphan,missingLetter])
    await claims(); await action(unopened,'reactivate')
    assert.equal((await client.query('select status from public.letter_v2_qr_codes where id=$1',[unopened])).rows[0].status,'unused')
    await claims(); await action(unfinished,'reactivate')
    assert.equal((await client.query('select status,claimed_at from public.letter_v2_qr_codes where id=$1',[unfinished])).rows[0].status,'claimed')
    assert.ok((await client.query('select claimed_at from public.letter_v2_qr_codes where id=$1',[unfinished])).rows[0].claimed_at)
    await claims(); await assert.rejects(action(orphan,'reactivate'),/link needs review/)
    await claims(); await action(published,'remove_letter')
    assert.equal((await client.query('select status,letter_id from public.letter_v2_qr_codes where id=$1',[published])).rows[0].status,'unused')
    assert.equal((await client.query('select id from public.letters where id=$1',[letter])).rowCount,0)
    await claims(); await action(published,'delete')
    assert.equal((await client.query('select id from public.letter_v2_qr_codes where id=$1',[published])).rowCount,0)
    await client.query('reset role')
    assert.equal((await client.query('select * from public.test_credentials')).rowCount,0)
    assert.equal((await client.query('select * from public.test_sessions')).rowCount,0)
    assert.equal((await client.query('select id from public.letters where id=$1',[checkout])).rowCount,1)
    const deleteCard=randomUUID(), deleteLetter=randomUUID()
    await client.query('insert into public.letter_v2_qr_codes(id,status,letter_id) values($1,\'published\',$2)',[deleteCard,deleteLetter])
    await client.query('insert into public.letters(id,letter_v2_qr_id) values($1,$2)',[deleteLetter,deleteCard])
    await claims(); await action(deleteCard,'delete')
    assert.equal((await client.query('select id from public.letter_v2_qr_codes where id=$1',[deleteCard])).rowCount,0)
    assert.equal((await client.query('select id from public.letters where id=$1',[deleteLetter])).rowCount,0)
    await client.query('reset role')
    const inconsistent=randomUUID()
    await client.query('insert into public.letter_v2_qr_codes(id,status,letter_id) values($1,\'published\',$2)',[inconsistent,checkout])
    await claims(); await assert.rejects(action(inconsistent,'delete'),/link needs review/)
    await client.query('reset role')
    const source=randomUUID(), transferredLetter=randomUUID()
    await client.query(`insert into public.letter_v2_qr_codes(id,status,letter_id,public_token,activation_code,claimed_at,published_at) values($1,'published',$2,'old-printed-token','OLD1-CODE',now(),now())`,[source,transferredLetter])
    await client.query('insert into public.letters(id,letter_v2_qr_id) values($1,$2)',[transferredLetter,source])
    await client.query('insert into public.test_credentials values($1)',[transferredLetter])
    await client.query('insert into public.test_sessions values($1)',[transferredLetter])
    async function renew(id) { return client.query('select public.renew_gift_qr($1) as id',[id]) }
    await claims('PH'); await assert.rejects(renew(source),/Owner access required/)
    await claims('ALL',300); await assert.rejects(renew(source),/Confirm your owner password/)
    await claims(); await assert.rejects(renew(card),/Renewal requires/)
    const newId=(await renew(source)).rows[0].id
    await assert.rejects(action(newId,'revoke'),/each action/)
    const moved=(await client.query('select * from public.letter_v2_qr_codes where id=$1',[newId])).rows[0]
    assert.equal(moved.status,'unused'); assert.equal(moved.letter_id,transferredLetter)
    assert.notEqual(moved.public_token,'old-printed-token'); assert.match(moved.activation_code,/^[A-F0-9]{4}-[A-F0-9]{4}$/)
    assert.deepEqual((await client.query('select status,letter_id from public.letter_v2_qr_codes where id=$1',[source])).rows[0],{status:'replaced',letter_id:null})
    assert.equal((await client.query('select letter_v2_qr_id from public.letters where id=$1',[transferredLetter])).rows[0].letter_v2_qr_id,newId)
    await claims(); await assert.rejects(renew(source),/Renewal requires/)
    await action(newId,'revoke'); await claims(); await action(newId,'reactivate')
    assert.equal((await client.query('select status from public.letter_v2_qr_codes where id=$1',[newId])).rows[0].status,'unused')
    await client.query('reset role; set role anon')
    assert.equal((await client.query('select * from public.claim_letter_v2_qr($1,$2)',[moved.public_token,'WRONG-CODE'])).rowCount,0)
    assert.equal((await client.query('select * from public.claim_letter_v2_qr($1,$2)',['old-printed-token','OLD1-CODE'])).rowCount,0)
    const activated=(await client.query('select * from public.claim_letter_v2_qr($1,$2)',[moved.public_token,moved.activation_code])).rows[0]
    assert.equal(activated.status,'published'); assert.equal(activated.letter_id,transferredLetter)
    await assert.rejects(renew(newId),/permission denied/)
    await client.query('reset role')
    assert.equal((await client.query('select * from public.test_credentials where letter_id=$1',[transferredLetter])).rowCount,1)
    assert.equal((await client.query('select * from public.test_sessions where letter_id=$1',[transferredLetter])).rowCount,1)
    assert.equal((await client.query("select * from gift_qr_private.action_log where qr_id=$1 and action='renew' and new_qr_id=$2",[source,newId])).rowCount,1)
    await client.query(`update public.letter_v2_qr_codes set public_token='normal-empty-card',activation_code='CODE-1234' where id=$1`,[card])
    await client.query('reset role; set role anon')
    assert.equal((await client.query("select * from public.claim_letter_v2_qr('normal-empty-card','CODE-1234')")).rows[0].status,'claimed')
    await assert.rejects(action(card,'delete'),/permission denied/)
    console.log('PASS owner/password/replay/REST boundaries; reset, revoke, reactivate, removal, deletion, checkout isolation; renewal preserves letter credentials/sessions, retires old QR, generates fresh credentials, requires activation even after reactivation, rejects wrong codes, preserves ordinary claims; migrations reapply')
  } finally { if(client) await client.end(); await db.stop() }
})().catch(error=>{ console.error(error); process.exitCode=1 })
