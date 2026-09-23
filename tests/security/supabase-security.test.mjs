import assert from "node:assert/strict";
import { test, after } from "node:test";
import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const anonKey = process.env.SUPABASE_ANON_KEY;
const enabled = process.env.MEFIE_SECURITY_TESTS === "1";

if (!enabled) {
  test("Supabase integration suite (set MEFIE_SECURITY_TESTS=1 to run)", { skip: true }, () => {});
} else if (!url || !anonKey) {
  test("Supabase integration suite has all required credentials", () => {
    assert.fail("Set SUPABASE_URL and SUPABASE_ANON_KEY.");
  });
} else {
  const clients = [];
  const createdEvents = [];
  const prefix = "MEFIE_TEST_" + Date.now().toString(36).toUpperCase();

  async function newUser() {
    const client = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data, error } = await client.auth.signInAnonymously();
    assert.ifError(error);
    assert.ok(data.user?.id);
    clients.push(client);
    return { client, userId: data.user.id };
  }

  async function rpc(client, fn, args) {
    const { data, error } = await client.rpc(fn, args);
    assert.ifError(error);
    return data;
  }

  test("anonymous role cannot call privileged event creation", async () => {
    const client = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { error } = await client.rpc("create_event", {
      p_name: prefix + "_unauth",
      p_invite_code: prefix + "_U",
    });
    assert.ok(error);
  });

  test("event ownership and membership isolation", async () => {
    const creator = await newUser();
    const member = await newUser();
    const stranger = await newUser();
    const invite = prefix + "_A";

    const created = await rpc(creator.client, "create_event", {
      p_name: prefix + "_EVENT",
      p_invite_code: invite,
    });
    const event = Array.isArray(created) ? created[0] : created;
    assert.ok(event?.id);
    createdEvents.push({ id: event.id, client: creator.client });

    const { data: strangerEvents, error: strangerEventError } = await stranger.client.from("events").select("id").eq("id", event.id);
    assert.ifError(strangerEventError);
    assert.equal(strangerEvents.length, 0);

    const resolved = await rpc(stranger.client, "resolve_event_invite", { p_invite_code: invite });
    assert.equal(resolved?.[0]?.event_id, event.id);

    const joined = await rpc(member.client, "join_event_by_invite", { p_invite_code: invite, p_display_name: "Security Test Member" });
    assert.ok(joined);

    const joinedAgain = await rpc(member.client, "join_event_by_invite", { p_invite_code: invite, p_display_name: "Security Test Member 2" });
    assert.equal(joinedAgain, joined);

    const { data: memberEvent, error: memberEventError } = await member.client.from("events").select("id,creator_auth_user_id").eq("id", event.id).single();
    assert.ifError(memberEventError);
    assert.equal(memberEvent.id, event.id);
    assert.notEqual(memberEvent.creator_auth_user_id, member.userId);

    const { data: participant, error: participantError } = await member.client.from("participants").select("id,auth_user_id,session_id").eq("id", joined).single();
    assert.ifError(participantError);
    assert.equal(participant.auth_user_id, member.userId);

    const { error: identityError } = await member.client.from("participants").update({ session_id: "attacker-controlled-session" }).eq("id", joined);
    assert.ok(identityError);

    const { data: directInsert, error: directInsertError } = await member.client.from("photos").insert({
      client_upload_id: crypto.randomUUID(),
      event_id: event.id,
      participant_id: joined,
      storage_path: event.id + "/" + crypto.randomUUID() + ".jpg",
      original_filename: "unauthorized.jpg",
      file_size: 1,
      width: 1,
      height: 1,
    }).select("id");
    assert.ok(directInsertError || !directInsert?.length);

    const { data: memberDelete, error: memberDeleteError } = await member.client.rpc("delete_event_as_creator", { p_event_id: event.id });
    assert.ifError(memberDeleteError);
    assert.equal(memberDelete, false);

    const removed = await rpc(creator.client, "remove_event_member_as_creator", { p_event_id: event.id, p_participant_id: joined });
    assert.equal(removed, true);

    const { data: removedMemberEvents, error: removedMemberError } = await member.client.from("events").select("id").eq("id", event.id);
    assert.ifError(removedMemberError);
    assert.equal(removedMemberEvents.length, 0);

    const rejoin = await member.client.rpc("join_event_by_invite", { p_invite_code: invite, p_display_name: "Should Not Rejoin" });
    assert.ok(rejoin.error);

    const deleted = await rpc(creator.client, "delete_event_as_creator", { p_event_id: event.id });
    assert.equal(deleted, true);
  });

  test("invalid invite cannot create membership", async () => {
    const user = await newUser();
    const { error } = await user.client.rpc("join_event_by_invite", {
      p_invite_code: prefix + "_DOES_NOT_EXIST",
      p_display_name: "Nope",
    });
    assert.ok(error);
  });

  after(async () => {
    for (const event of createdEvents) await event.client.rpc("delete_event_as_creator", { p_event_id: event.id });
    for (const client of clients) await client.auth.signOut().catch(() => {});
  });
}
