// Isolated Postgres-engine checks for the default-deny draft. They do not
// establish Supabase Auth, production policies or server/API security.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {PGlite} from '@electric-sql/pglite';

test('draft enables RLS, denies operational reads, and isolates personal theme settings',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'susanoo-pg-'));
 let db=new PGlite(dir);
 try {
  await db.exec(`create role anon; create role authenticated; create schema auth;
   create table auth.users(id uuid primary key);
   create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
   grant usage on schema auth to authenticated,anon;
   grant execute on function auth.uid() to authenticated,anon;
   insert into auth.users values ('00000000-0000-0000-0000-000000000001'),('00000000-0000-0000-0000-000000000002'),('00000000-0000-0000-0000-000000000003');`);
  await db.exec(await readFile(new URL('../supabase/drafts/20261116163520_core_foundation.sql.draft',import.meta.url),'utf8'));
  const rls=await db.query("select count(*)::int n from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname like 'os_%' and c.relkind='r' and c.relrowsecurity");
  assert.equal(rls.rows[0].n,25);
  // Assert the version chain prevents a placement from pinning a different
  // agreement version than the one attached to its consideration's role.
  await db.exec(`insert into public.os_company(id,name) values ('10000000-0000-0000-0000-000000000001','Synthetic company');
   insert into public.os_membership(company_id,user_id,role) values ('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001','talent_ops'),('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002','partner');
   insert into public.os_partner(company_id,id,name) values ('10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','Synthetic partner');
   insert into public.os_legal_entity(company_id,id,name) values ('10000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001','Synthetic legal entity');
   insert into public.os_partner_entity values ('10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001');
   insert into public.os_agreement(company_id,id,partner_id,legal_entity_id) values ('10000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001');
   insert into public.os_agreement_version(company_id,id,agreement_id,label) values ('10000000-0000-0000-0000-000000000001','50000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000001','v1'),('10000000-0000-0000-0000-000000000001','50000000-0000-0000-0000-000000000002','40000000-0000-0000-0000-000000000001','v2');
   insert into public.os_requirement(company_id,id,partner_id,agreement_id,agreement_version_id,title) values ('10000000-0000-0000-0000-000000000001','60000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000001','50000000-0000-0000-0000-000000000001','Synthetic role');
   insert into public.os_candidate(company_id,id,display_name) values ('10000000-0000-0000-0000-000000000001','70000000-0000-0000-0000-000000000001','Synthetic candidate');
   insert into public.os_consideration(company_id,id,requirement_id,candidate_id) values ('10000000-0000-0000-0000-000000000001','80000000-0000-0000-0000-000000000001','60000000-0000-0000-0000-000000000001','70000000-0000-0000-0000-000000000001');`);
  await assert.rejects(db.exec(`insert into public.os_placement(company_id,consideration_id,requirement_id,agreement_id,agreement_version_id) values ('10000000-0000-0000-0000-000000000001','80000000-0000-0000-0000-000000000001','60000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000001','50000000-0000-0000-0000-000000000002')`),/foreign key/);
  await db.exec(`insert into public.os_placement(company_id,id,consideration_id,requirement_id,agreement_id,agreement_version_id) values ('10000000-0000-0000-0000-000000000001','90000000-0000-0000-0000-000000000001','80000000-0000-0000-0000-000000000001','60000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000001','50000000-0000-0000-0000-000000000001')`);
  await assert.rejects(db.exec(`insert into public.os_fee_entitlement(company_id,placement_id,agreement_version_id,currency) values ('10000000-0000-0000-0000-000000000001','90000000-0000-0000-0000-000000000001','50000000-0000-0000-0000-000000000002','INR')`),/foreign key/);
  await db.exec("set role authenticated; set request.jwt.claim.sub='00000000-0000-0000-0000-000000000001'");
  await assert.rejects(db.query('select * from public.os_candidate'),/permission denied/);
  await db.exec("insert into public.os_user_settings(user_id,theme) values ('00000000-0000-0000-0000-000000000001','light')");
  await assert.rejects(db.exec("insert into public.os_user_settings(user_id,theme) values ('00000000-0000-0000-0000-000000000002','light')"),/row-level security/);
  await db.exec("set request.jwt.claim.sub='00000000-0000-0000-0000-000000000002'");
  assert.equal((await db.query('select * from public.os_user_settings')).rows.length,0);
  const crossUpdate=await db.query("update public.os_user_settings set theme='dark' where user_id='00000000-0000-0000-0000-000000000001' returning user_id");
  assert.equal(crossUpdate.rows.length,0);
  await db.exec("set request.jwt.claim.sub='00000000-0000-0000-0000-000000000001'");
  assert.equal((await db.query('select theme from public.os_user_settings')).rows[0].theme,'light');
  const memberships=await db.query('select user_id from public.os_membership');
  assert.deepEqual(memberships.rows.map(x=>x.user_id),['00000000-0000-0000-0000-000000000001']);
  await db.exec("set request.jwt.claim.sub='00000000-0000-0000-0000-000000000003'");
  await assert.rejects(db.exec("insert into public.os_user_settings(user_id,theme) values ('00000000-0000-0000-0000-000000000003','light')"),/row-level security/);
  await db.exec("reset role; update public.os_membership set active=false where user_id='00000000-0000-0000-0000-000000000001'; set role authenticated; set request.jwt.claim.sub='00000000-0000-0000-0000-000000000001'");
  assert.equal((await db.query('select * from public.os_user_settings')).rows.length,0);
  await db.exec("reset role; update public.os_membership set active=true where user_id='00000000-0000-0000-0000-000000000001'");
  await db.close(); db=new PGlite(dir);
  await db.exec("set role authenticated; set request.jwt.claim.sub='00000000-0000-0000-0000-000000000001'");
  assert.equal((await db.query('select theme from public.os_user_settings')).rows[0].theme,'light');
 } finally {await db.close();rmSync(dir,{recursive:true,force:true})}
});
