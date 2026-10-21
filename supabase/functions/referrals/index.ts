import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info", "Access-Control-Allow-Methods": "POST, OPTIONS", "Content-Type": "application/json" };
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: cors });
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return reply({ error: "METHOD_NOT_ALLOWED" }, 405);
  const url = Deno.env.get("SUPABASE_URL"), anon = Deno.env.get("SUPABASE_ANON_KEY"), service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !anon || !service) return reply({ error: "REFERRAL_BACKEND_NOT_CONFIGURED" }, 503);
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return reply({ error: "SIGN_IN_REQUIRED" }, 401);
  const authClient = createClient(url, anon, { global: { headers: { Authorization: authHeader } } });
  const { data: { user }, error: authError } = await authClient.auth.getUser();
  if (authError || !user) return reply({ error: "INVALID_SESSION" }, 401);
  const admin = createClient(url, service, { auth: { persistSession: false } });
  try {
    const body = await req.json();
    const rawUsername = String(user.user_metadata?.username || "").trim();
    if (!/^[A-Za-z0-9_]{3,20}$/.test(rawUsername)) return reply({ error: "USERNAME_REQUIRED", message: "Your account needs a username of 3–20 letters, numbers or underscores." }, 400);
    const { error: profileError } = await admin.from("player_profiles").upsert({ user_id: user.id, username: rawUsername }, { onConflict: "user_id" });
    if (profileError) return reply({ error: profileError.code === "23505" ? "USERNAME_TAKEN" : "PROFILE_SAVE_FAILED", message: profileError.code === "23505" ? "That username is already taken." : profileError.message }, 400);

    if (body.action === "claim") {
      const requested = String(body.username || "").trim().replace(/^@/, "");
      if (!/^[A-Za-z0-9_]{3,20}$/.test(requested)) return reply({ error: "INVALID_USERNAME", message: "Enter a valid inviter username." }, 400);
      const { data: inviter, error: lookupError } = await admin.from("player_profiles").select("user_id,username").ilike("username", requested).maybeSingle();
      if (lookupError || !inviter) return reply({ error: "INVITER_NOT_FOUND", message: "No LEGACY account was found for that username." }, 404);
      if (inviter.user_id === user.id) return reply({ error: "SELF_REFERRAL", message: "You cannot use your own username." }, 400);
      const { data: prior } = await admin.from("player_referrals").select("referred_user_id").eq("referred_user_id", user.id).maybeSingle();
      if (prior) return reply({ error: "ALREADY_REFERRED", message: "Your account already has a referral attached." }, 409);
      const { error: insertError } = await admin.from("player_referrals").insert({ referred_user_id: user.id, referrer_user_id: inviter.user_id });
      if (insertError) return reply({ error: "REFERRAL_SAVE_FAILED", message: "Could not record this referral." }, 409);
      return reply({ success: true, message: `Referral recorded. You were invited by @${inviter.username}.` });
    }

    if (body.action === "list") {
      const { data, error } = await admin.from("player_referrals").select("created_at,referred:player_profiles!player_referrals_referred_user_id_fkey(username)").eq("referrer_user_id", user.id).order("created_at", { ascending: false }).limit(200);
      if (error) return reply({ error: "REFERRAL_LIST_FAILED", message: error.message }, 400);
      const referrals = (data || []).map((r: any) => ({ username: r.referred?.username || "Explorer", joined_at: r.created_at }));
      return reply({ count: referrals.length, referrals });
    }
    return reply({ error: "UNKNOWN_ACTION" }, 400);
  } catch (_e) { return reply({ error: "INVALID_REQUEST" }, 400); }
});
