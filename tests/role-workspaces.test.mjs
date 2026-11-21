import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

test("role policies scope scouts and partner releases", async () => {
  const db = new PGlite();
  const ids = Array.from(
    { length: 5 },
    (_, i) => "00000000-0000-4000-8000-" + String(i + 1).padStart(12, "0"),
  );
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
    await db.exec(
      "alter table candidates add column email text; alter table submissions add column source_url text, add column display_stage text;",
    );
    await db.exec(
      await readFile(
        new URL(
          "../supabase/migrations/20261121135637_role_workspaces.sql",
          import.meta.url,
        ),
        "utf8",
      ),
    );
    await db.exec(
      await readFile(
        new URL(
          "../supabase/migrations/20261121140045_scout_activity.sql",
          import.meta.url,
        ),
        "utf8",
      ),
    );
    for (const id of ids)
      await db.query("insert into auth.users values ($1)", [id]);
    await db.exec(
      "insert into scouts(name) values ('Scout A'),('Scout B'); insert into partners(name) values ('Partner A'),('Partner B');",
    );
    await db.query(
      "insert into workspace_members(user_id,role) values ($1,'executive')",
      [ids[0]],
    );
    for (let i = 1; i <= 2; i++)
      await db.query(
        "insert into workspace_members(user_id,role,scout_id) select $1,'scout',id from scouts where name=$2",
        [ids[i], i === 1 ? "Scout A" : "Scout B"],
      );
    for (let i = 3; i <= 4; i++)
      await db.query(
        "insert into workspace_members(user_id,role,partner_id) select $1,'partner',id from partners where name=$2",
        [ids[i], i === 3 ? "Partner A" : "Partner B"],
      );
    await db.exec(
      "insert into requirements(title,partner_id) select 'Role',id from partners; insert into candidates(name,scout_id) select name,id from scouts; insert into submissions(candidate_id,requirement_id,scout_id) select c.id,r.id,c.scout_id from candidates c cross join requirements r; insert into partner_releases(partner_id,candidate_name,requirement,stage) select id,name,'Role','Introduced' from partners;",
    );
    await db.exec("set role authenticated");
    async function user(i) {
      await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
        ids[i],
      ]);
    }
    await user(0);
    assert.equal((await db.query("select id from submissions")).rows.length, 4);
    await user(1);
    assert.equal((await db.query("select id from submissions")).rows.length, 2);
    assert.equal(
      (await db.query("select name from candidates")).rows.length,
      1,
    );
    await db.exec(
      "insert into scout_messages(scout_id,body) select id,'Hello' from scouts",
    );
    await user(2);
    assert.equal(
      (await db.query("select id from scout_messages")).rows.length,
      0,
    );
    await user(3);
    assert.equal(
      (await db.query("select name from partners")).rows[0].name,
      "Partner A",
    );
    assert.equal(
      (await db.query("select id from requirements")).rows.length,
      1,
    );
    assert.equal((await db.query("select id from candidates")).rows.length, 0);
    assert.equal((await db.query("select id from submissions")).rows.length, 0);
    assert.equal(
      (await db.query("select candidate_name from partner_releases")).rows[0]
        .candidate_name,
      "Partner A",
    );
    assert.equal(
      (await db.query("select id from scout_messages")).rows.length,
      0,
    );
    await user(4);
    assert.equal(
      (await db.query("select candidate_name from partner_releases")).rows[0]
        .candidate_name,
      "Partner B",
    );
  } finally {
    await db.close();
  }
});
