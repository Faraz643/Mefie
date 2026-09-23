import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

const BUCKET = "photos";
const GRACE_MS = 24 * 60 * 60 * 1000;
const RUN_COOLDOWN_MS = 24 * 60 * 60 * 1000;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PHOTO_FILE_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}(?:\.thumb)?\.jpg$/i;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: corsHeaders,
  });
}

function getSecretKey() {
  const raw = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (parsed?.default) return parsed.default as string;
    } catch {
      // Fall through to the legacy variable below.
    }
  }
  return Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed." }, 405);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return json({ error: "Missing authorization." }, 401);
  }

  const token = authHeader.slice("Bearer ".length).trim();
  const body = await req.json().catch(() => ({}));
  const eventId = String(body?.event_id ?? "").trim();

  if (!UUID_RE.test(eventId)) return json({ error: "Invalid event id." }, 400);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const publishableKey =
    Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ??
    Deno.env.get("SUPABASE_ANON_KEY") ??
    "";
  const secretKey = getSecretKey();

  if (!supabaseUrl || !publishableKey || !secretKey) {
    console.error("Required Supabase function environment variables are missing.");
    return json({ error: "Server configuration error." }, 500);
  }

  const userClient = createClient(supabaseUrl, publishableKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: authHeader } },
  });
  const admin = createClient(supabaseUrl, secretKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: userData, error: userError } = await userClient.auth.getUser(token);
  if (userError || !userData.user) return json({ error: "Unauthorized." }, 401);

  const userId = userData.user.id;

  const { data: event, error: eventError } = await admin
    .from("events")
    .select("id,creator_auth_user_id")
    .eq("id", eventId)
    .maybeSingle();

  if (eventError) {
    console.error("Event lookup failed:", eventError.message);
    return json({ error: "Could not verify event ownership." }, 500);
  }

  if (!event || event.creator_auth_user_id !== userId) {
    return json({ error: "Only the event creator can run photo cleanup." }, 403);
  }

  const { data: previousRun } = await admin
    .from("photo_cleanup_runs")
    .select("last_run_at,last_scanned_count,last_deleted_count")
    .eq("event_id", eventId)
    .maybeSingle();

  if (
    previousRun?.last_run_at &&
    Date.now() - new Date(previousRun.last_run_at).getTime() < RUN_COOLDOWN_MS
  ) {
    return json({
      ok: true,
      skipped: true,
      reason: "cooldown",
      scanned: previousRun.last_scanned_count ?? 0,
      deleted: previousRun.last_deleted_count ?? 0,
    });
  }

  const { data: photos, error: photosError } = await admin
    .from("photos")
    .select("storage_path,thumbnail_path")
    .eq("event_id", eventId);

  if (photosError) {
    console.error("Photo reference lookup failed:", photosError.message);
    return json({ error: "Could not inspect photo references." }, 500);
  }

  const referenced = new Set<string>();
  for (const photo of photos ?? []) {
    if (photo.storage_path) referenced.add(photo.storage_path);
    if (photo.thumbnail_path) referenced.add(photo.thumbnail_path);
  }

  const { data: objects, error: objectsError } = await admin.rpc(
    "list_photo_storage_objects",
    { p_prefix: `${eventId}/` },
  );

  if (objectsError) {
    console.error("Storage object lookup failed:", objectsError.message);
    return json({ error: "Could not inspect photo storage." }, 500);
  }

  const cutoff = Date.now() - GRACE_MS;
  const candidates: string[] = [];

  for (const object of objects ?? []) {
    const name = String(object.name ?? "");
    const path = `${eventId}/${name}`;
    if (!PHOTO_FILE_RE.test(name)) continue;
    if (referenced.has(path)) continue;

    const createdAt = object.created_at ? new Date(object.created_at).getTime() : NaN;
    if (!Number.isFinite(createdAt) || createdAt > cutoff) continue;

    candidates.push(path);
  }

  let deleted = 0;

  for (let offset = 0; offset < candidates.length; offset += 100) {
    const batch = candidates.slice(offset, offset + 100);
    const { error: removeError } = await admin.storage.from(BUCKET).remove(batch);
    if (removeError) {
      console.error("Storage cleanup failed:", removeError.message);
      return json({
        error: "Cleanup stopped before completion.",
        scanned: objects?.length ?? 0,
        deleted,
      }, 500);
    }
    deleted += batch.length;
  }

  const now = new Date().toISOString();
  const { error: runError } = await admin
    .from("photo_cleanup_runs")
    .upsert({
      event_id: eventId,
      last_run_at: now,
      last_scanned_count: objects?.length ?? 0,
      last_deleted_count: deleted,
      updated_at: now,
    });

  if (runError) {
    console.error("Cleanup run log failed:", runError.message);
    return json({
      ok: true,
      scanned: objects?.length ?? 0,
      deleted,
      warning: "Cleanup completed, but run metadata could not be recorded.",
    });
  }

  return json({
    ok: true,
    skipped: false,
    scanned: objects?.length ?? 0,
    referenced: referenced.size,
    candidates: candidates.length,
    deleted,
    grace_hours: GRACE_MS / 3600000,
  });
});
