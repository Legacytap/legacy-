// Supabase Edge Function: create-sol-quote
// Fixed server-side price: 0.0069 SOL per 3 refills.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const PRICE_LAMPORTS_PER_THREE = 6_900_000;
const ALLOWED = new Set([3, 6, 9, 12, 30, 60]);
const json = (body: unknown, status=200) => Response.json(body, {status, headers:{"Cache-Control":"no-store"}});
Deno.serve(async (req) => {
 if (req.method !== "POST") return json({error:"Method not allowed"},405);
 const auth = req.headers.get("Authorization");
 if (!auth) return json({error:"Sign in required"},401);
 const url = Deno.env.get("SUPABASE_URL"), anon = Deno.env.get("SUPABASE_ANON_KEY"), service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
 if (!url || !anon || !service) return json({error:"Payment service is not configured"},503);
 const userClient = createClient(url, anon, {global:{headers:{Authorization:auth}}});
 const {data:{user},error:authErr} = await userClient.auth.getUser();
 if (authErr || !user) return json({error:"Unauthorized"},401);
 const body = await req.json().catch(()=>null);
 if (!body || !Number.isSafeInteger(body.refills) || !ALLOWED.has(body.refills)) return json({error:"Invalid refill quantity"},400);
 const receiver = Deno.env.get("LEGACY_SOL_RECEIVER");
 if (!receiver) return json({error:"Payment receiver is not configured"},503);
 const admin = createClient(url, service);
 const {data:wallet,error:walletErr} = await admin.from("wallet_links").select("wallet_address").eq("user_id",user.id).maybeSingle();
 if (walletErr || !wallet?.wallet_address) return json({error:"Connect and link your wallet first"},400);
 // Refills are restricted to known bundles. Never accept price or recipient from the browser.
 const lamports = (body.refills / 3) * PRICE_LAMPORTS_PER_THREE;
 const {data:quote,error:insertError} = await admin.from("sol_quotes").insert({user_id:user.id,wallet_address:wallet.wallet_address,refills:body.refills,amount_lamports:lamports,recipient:receiver,expires_at:new Date(Date.now()+10*60*1000).toISOString()}).select("id,expires_at").single();
 if (insertError || !quote) return json({error:"Could not create payment quote"},500);
 return json({quote_id:quote.id,recipient:receiver,lamports,refills:body.refills,expires_at:quote.expires_at,expires_in_seconds:600});
});
