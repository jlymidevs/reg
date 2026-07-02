// qr-checkin — QR attendance check-in.
// POST { event_id: uuid, qr_code_value: string, method?: 'qr' | 'manual' }
// Caller must be authenticated AND pass public.can_scan() (pcm_staff / heads / admin).
// Never returns PII beyond name + member_code + journey_status.

import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "content-type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ success: false, error: "POST only" }, 405);

  let body: { event_id?: string; qr_code_value?: string; method?: string };
  try {
    body = await req.json();
  } catch {
    return json({ success: false, error: "invalid JSON" }, 400);
  }
  const { event_id, qr_code_value } = body;
  const method = body.method === "manual" ? "manual" : "qr";
  if (!event_id || !qr_code_value) {
    return json({ success: false, error: "event_id and qr_code_value required" }, 400);
  }

  const url = Deno.env.get("SUPABASE_URL")!;
  const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const caller = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
  });

  // 1) authenticate + authorize (can_scan runs as caller, sees caller's auth.uid())
  const { data: userData, error: userErr } = await caller.auth.getUser();
  if (userErr || !userData?.user) return json({ success: false, error: "unauthenticated" }, 401);

  const { data: allowed, error: roleErr } = await caller.rpc("can_scan");
  if (roleErr || allowed !== true) {
    return json({ success: false, error: "not authorized to scan" }, 403);
  }

  // 2) resolve member from opaque QR token
  const { data: member, error: memberErr } = await admin
    .from("members")
    .select("id, name, member_code, journey_status")
    .eq("qr_code_value", qr_code_value)
    .maybeSingle();
  if (memberErr) return json({ success: false, error: "lookup failed" }, 500);
  if (!member) return json({ success: false, error: "QR code not recognized" }, 404);

  // 3) validate event
  const { data: event } = await admin
    .from("events")
    .select("id, is_active, allow_walk_in, starts_at, ends_at")
    .eq("id", event_id)
    .maybeSingle();
  if (!event || !event.is_active) {
    return json({ success: false, error: "event not found or inactive" }, 404);
  }

  const memberSummary = {
    id: member.id,
    name: member.name,
    member_code: member.member_code,
    journey_status: member.journey_status,
  };

  // 4) insert attendance; unique(event_id, member_id) makes duplicates a friendly no-op
  const { error: insErr } = await admin.from("attendance_logs").insert({
    event_id,
    member_id: member.id,
    method,
    scanned_by: userData.user.id,
  });

  if (insErr) {
    if (insErr.code === "23505") {
      const { data: prev } = await admin
        .from("attendance_logs")
        .select("checked_in_at")
        .eq("event_id", event_id)
        .eq("member_id", member.id)
        .single();
      return json({
        success: true,
        duplicate: true,
        member: memberSummary,
        checked_in_at: prev?.checked_in_at ?? null,
      });
    }
    return json({ success: false, error: "check-in failed" }, 500);
  }

  // 5) best-effort: flip registration to attended
  await admin
    .from("event_registrations")
    .update({ status: "attended" })
    .eq("event_id", event_id)
    .eq("member_id", member.id);

  return json({
    success: true,
    duplicate: false,
    member: memberSummary,
    checked_in_at: new Date().toISOString(),
  });
});
