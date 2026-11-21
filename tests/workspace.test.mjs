import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

test("workspace admits provisioned operators and revokes access to stored records", async () => {
  const db = new PGlite();
  const user = "efea1634-c734-4190-bf17-2404ad16370f";
  try {
    await db.exec(`create role anon; create role authenticated; create schema auth;
      create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql stable as $$select current_setting('request.jwt.claim.sub',true)::uuid$$;
      grant usage on schema auth to authenticated;`);
    await db.exec(
      await readFile(
        new URL(
          "../supabase/migrations/20261121074330_workspace.sql",
          import.meta.url,
        ),
        "utf8",
      ),
    );
    await db.query("insert into auth.users values ($1)", [user]);
    await db.query("insert into workspace_members values ($1)", [user]);
    await db.exec("set role authenticated");
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
      user,
    ]);
    await db.exec(`insert into partners(name) values ('fixture');
      insert into candidates(name) values ('fixture');
      insert into requirements(title,partner_id) select 'fixture',id from partners;
      insert into submissions(candidate_id,requirement_id) select c.id,r.id from candidates c cross join requirements r;`);
    assert.equal((await db.query("select id from submissions")).rows.length, 1);
    await assert.rejects(
      db.exec(
        "insert into submissions(candidate_id,requirement_id) select candidate_id,requirement_id from submissions",
      ),
      /unique/i,
    );
    await assert.rejects(
      db.query("insert into workspace_members values ($1)", [user]),
      /permission/i,
    );
    await db.exec(
      "reset role; delete from workspace_members; set role authenticated",
    );
    assert.equal((await db.query("select id from submissions")).rows.length, 0);
    await assert.rejects(
      db.exec("insert into candidates(name) values ('private')"),
      /row.level security/i,
    );
    await db.exec("reset role; set role anon");
    await assert.rejects(db.exec("select id from candidates"), /permission/i);
  } finally {
    await db.close();
  }
});
