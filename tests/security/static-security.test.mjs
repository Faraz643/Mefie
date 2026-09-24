import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../");
const migration = (name) => readFile(path.join(root, "supabase", "migrations", name), "utf8");

test("RLS hardening keeps application tables authenticated-only", async () => {
  const sql = await migration("012_rls_hardening.sql");
  for (const table of ["events", "participants", "photos", "event_temporary_invites", "profiles", "users"]) {
    assert.ok(sql.includes("alter table public." + table + " enable row level security"));
    assert.ok(sql.includes("revoke all on table public." + table + " from anon"));
  }
  assert.match(sql, /to authenticated\s+using \(\(select private\.can_access_event\(id\)\)\)/);
});

test("creator identity is always derived from auth.uid()", async () => {
  const sql = await migration("018_create_event_as_authenticated_user.sql");
  assert.match(sql, /security definer/);
  assert.match(sql, /set search_path = ''/);
  assert.match(sql, /creator_auth_user_id,\s*creator_session_id/);
  assert.match(sql, /\(select auth\.uid\(\)\)/);
  assert.match(sql, /revoke all on function public\.create_event\(text, text\) from public, anon/);
});

test("create_event avoids invite_code ambiguity and handles invite-code races", async () => {
  const sql = await migration("20260924062314_fix_event_creation_on_conflict_target.sql");
  assert.match(sql, /returns table\(id uuid, invite_code text\)/);
  assert.match(sql, /extensions\.gen_random_bytes\(6\)/);
  assert.match(sql, /on conflict on constraint events_invite_code_key do nothing/);
  assert.match(sql, /returning events\.id, events\.invite_code/);
  assert.doesNotMatch(sql, /on conflict \(invite_code\)/);
  assert.match(sql, /revoke all on function public\.create_event\(text, text\) from public, anon/);
  assert.match(sql, /grant execute on function public\.create_event\(text, text\) to authenticated/);
});

test("participant identity protection uses null-safe comparisons", async () => {
  const sql = await migration("20260924062249_harden_event_creation_and_participant_identity.sql");
  for (const field of ["auth_user_id", "session_id", "event_id", "id", "user_id", "joined_at"]) {
    assert.match(sql, new RegExp(`new\\.${field} is distinct from old\\.${field}`));
  }
  assert.match(sql, /old\.auth_user_id is distinct from \(select auth\.uid\(\)\)/);
});

test("invite joins are atomic and authenticated", async () => {
  const sql = await migration("021_atomic_invite_join.sql");
  assert.match(sql, /on conflict \(event_id, auth_user_id\)/);
  assert.match(sql, /revoke all on function public\.join_event_by_invite\(text, text\) from public, anon/);
  assert.match(sql, /grant execute on function public\.join_event_by_invite\(text, text\) to authenticated/);
});

test("photo metadata cannot be inserted directly", async () => {
  const sql = await migration("033_finalize_photo_upload_rpc.sql");
  assert.match(sql, /revoke insert on table public\.photos from authenticated/);
  assert.match(sql, /grant execute on function public\.finalize_photo_upload\(/);
  assert.match(sql, /o\.owner_id = current_user_id::text/);
  assert.match(sql, /p_storage_path <> p_event_id::text \|\| '\/' \|\| p_client_upload_id::text \|\| '\.jpg'/);
});

test("participant identity protection handles nullable legacy fields", async () => {
  const sql = await migration("035_fix_nullable_participant_identity_check.sql");
  assert.match(sql, /new\.user_id is distinct from old\.user_id/);
  assert.match(sql, /new\.event_id <> old\.event_id/);
  assert.match(sql, /new\.session_id <> old\.session_id/);
});

test("orphan cleanup control plane is service-role-only", async () => {
  const sql = await migration("20260923120000_036_photo_orphan_cleanup.sql");
  assert.match(sql, /alter table public\.photo_cleanup_runs enable row level security/);
  assert.match(sql, /revoke all on table public\.photo_cleanup_runs from public, anon, authenticated/);
  assert.match(sql, /grant select, insert, update on table public\.photo_cleanup_runs to service_role/);
  assert.match(sql, /revoke all on function public\.list_photo_storage_objects\(text\) from public, anon, authenticated/);
  assert.match(sql, /grant execute on function public\.list_photo_storage_objects\(text\) to service_role/);
});

test("security-definer migrations pin the search_path", async () => {
  const files = [
    "012_rls_hardening.sql",
    "018_create_event_as_authenticated_user.sql",
    "021_atomic_invite_join.sql",
    "026_secure_photo_delete_rpc.sql",
    "033_finalize_photo_upload_rpc.sql",
    "20260923120000_036_photo_orphan_cleanup.sql",
    "20260924061714_fix_create_event_invite_code_ambiguity.sql",
    "20260924062249_harden_event_creation_and_participant_identity.sql",
    "20260924062314_fix_event_creation_on_conflict_target.sql",
  ];
  for (const file of files) {
    const sql = await migration(file);
    const securityDefiners = (sql.match(/security definer/gi) || []).length;
    const pinnedSearchPaths = (sql.match(/set search_path = ''/gi) || []).length;
    assert.ok(pinnedSearchPaths >= securityDefiners, file + ": every SECURITY DEFINER function must pin search_path");
  }
});
