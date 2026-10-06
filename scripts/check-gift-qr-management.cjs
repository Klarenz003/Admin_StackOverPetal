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
      create role anon; create role authenticated; create schema auth;
      create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb $$;
      create function auth.uid() returns uuid language sql stable as $$ select (auth.jwt()->>'sub')::uuid $$;
      create function public.current_admin_market() returns text language sql stable as $$ select auth.jwt()->>'admin_market' $$;
      create table auth.sessions(id uuid primary key,user_id uuid);
      create table public.letter_v2_qr_codes(id uuid primary key,product_name text,status text,letter_id uuid,claimed_at timestamptz,published_at timestamptz,revoked_at timestamptz);
      create table public.letters(id uuid primary key,letter_v2_qr_id uuid references public.letter_v2_qr_codes(id) on delete set null);
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
    const owner=randomUUID(), card=randomUUID(), published=randomUUID(), letter=randomUUID(), checkout=randomUUID()
    await client.query(`insert into public.letter_v2_qr_codes(id,status,letter_id) values($1,'claimed',null),($2,'published',$3)`,[card,published,letter])
    await client.query(`insert into public.letters values($1,$2),($3,null)`,[letter,published,checkout])
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
    await client.query('insert into public.letters values($1,$2)',[deleteLetter,deleteCard])
    await claims(); await action(deleteCard,'delete')
    assert.equal((await client.query('select id from public.letter_v2_qr_codes where id=$1',[deleteCard])).rowCount,0)
    assert.equal((await client.query('select id from public.letters where id=$1',[deleteLetter])).rowCount,0)
    await client.query('reset role')
    const inconsistent=randomUUID()
    await client.query('insert into public.letter_v2_qr_codes(id,status,letter_id) values($1,\'published\',$2)',[inconsistent,checkout])
    await claims(); await assert.rejects(action(inconsistent,'delete'),/link needs review/)
    await client.query('reset role; set role anon')
    await assert.rejects(action(card,'delete'),/permission denied/)
    console.log('PASS owner-only access, fresh password/session checks, replay denial, REST bypass prevention, safe reset, revoke, letter removal, credential/session cascade, deletion and checkout isolation; migration reapply')
  } finally { if(client) await client.end(); await db.stop() }
})().catch(error=>{ console.error(error); process.exitCode=1 })
