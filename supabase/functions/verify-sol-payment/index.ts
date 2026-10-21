// Supabase Edge Function: verify-sol-payment
// Validates a finalized transaction against an unexpired server-side quote, then atomically records/credits it.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const json = (body: unknown, status=200) => Response.json(body, {status, headers:{"Cache-Control":"no-store"}});
const rpcUrl = () => Deno.env.get("SOLANA_RPC_URL");
const validSignature = (s: unknown) => typeof s === "string" && /^[1-9A-HJ-NP-Za-km-z]{80,100}$/.test(s);
Deno.serve(async (req) => {
 if (req.method !== "POST") return json({error:"Method not allowed"},405);
 const auth = req.headers.get("Authorization");
 if (!auth) return json({error:"Sign in required"},401);
 const url=Deno.env.get("SUPABASE_URL"), anon=Deno.env.get("SUPABASE_ANON_KEY"), service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"), rpc=rpcUrl();
 if(!url||!anon||!service||!rpc) return json({error:"Payment verification is not configured"},503);
 const userClient=createClient(url,anon,{global:{headers:{Authorization:auth}}});
 const {data:{user},error:authErr}=await userClient.auth.getUser();
 if(authErr||!user) return json({error:"Unauthorized"},401);
 const body=await req.json().catch(()=>null);
 const signature=body?.signature, quoteId=body?.quote_id;
 if(!validSignature(signature)||typeof quoteId!=="string"||quoteId.length>64) return json({error:"Invalid signature or quote ID"},400);
 const admin=createClient(url,service);
 const {data:q,error:qErr}=await admin.from("sol_quotes").select("*").eq("id",quoteId).eq("user_id",user.id).maybeSingle();
 if(qErr||!q) return json({error:"Quote not found"},404);
 // Idempotent retry: if the same signature already fulfilled this quote, return success without crediting twice.
 const {data:prior}=await admin.from("sol_payments").select("signature,refills,quote_id").eq("quote_id",q.id).maybeSingle();
 if(prior?.signature===signature) return json({success:true,already_processed:true,refills:prior.refills});
 if(q.used_at) return json({error:"Quote already used"},409);
 if(new Date(q.expires_at).getTime()<Date.now()) return json({error:"Quote expired; request a new quote"},400);
 try {
   const response=await fetch(rpc,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({jsonrpc:"2.0",id:1,method:"getTransaction",params:[signature,{encoding:"jsonParsed",commitment:"finalized",maxSupportedTransactionVersion:0}]})});
   if(!response.ok) return json({error:"RPC temporarily unavailable; retry verification"},503);
   const payload=await response.json();
   if(payload?.error) return json({error:"RPC could not verify transaction; retry later"},503);
   const tx=payload?.result;
   if(!tx || tx.meta?.err || !Number.isInteger(tx.slot) || !Number.isInteger(tx.blockTime)) return json({error:"Transaction is not finalized successfully"},400);
   // Reject transfers made before this quote was created, preventing reuse of old payments.
   const quoteCreated=Math.floor(new Date(q.created_at).getTime()/1000);
   if(tx.blockTime < quoteCreated-30) return json({error:"Transaction predates this quote"},400);
   const keys=tx.transaction?.message?.accountKeys||[];
   const signerKeys=keys.filter((k:any)=>k?.signer===true).map((k:any)=>k.pubkey);
   if(!signerKeys.includes(q.wallet_address)) return json({error:"Connected wallet did not sign this transaction"},400);
   const instructions=tx.transaction?.message?.instructions||[];
   const matches=instructions.filter((ix:any)=>ix?.program==="system" && ix?.parsed?.type==="transfer" && ix?.parsed?.info?.source===q.wallet_address && ix?.parsed?.info?.destination===q.recipient);
   // Require exactly one matching direct transfer and the exact amount; no over/underpayment ambiguity.
   if(matches.length!==1 || !Number.isSafeInteger(matches[0]?.parsed?.info?.lamports) || Number(matches[0].parsed.info.lamports)!==Number(q.amount_lamports)) return json({error:"Payment does not exactly match this quote"},400);
   const {data:result,error:creditErr}=await admin.rpc("apply_verified_sol_payment",{p_signature:signature,p_user_id:user.id,p_quote_id:q.id});
   if(creditErr) {
     const message=String(creditErr.message||"");
     if(message.includes("QUOTE_EXPIRED")) return json({error:"Quote expired; request a new quote"},400);
     if(message.includes("QUOTE_ALREADY_USED")||message.includes("SIGNATURE_ALREADY_USED")) return json({error:"Quote or transaction already used"},409);
     if(message.includes("QUOTE_NOT_FOUND")) return json({error:"Quote not found"},404);
     return json({error:"Payment verified but crediting needs support review; do not pay again"},500);
   }
   return json(result);
 } catch (_e) {
   return json({error:"Verification service temporarily unavailable; retry with the same transaction signature"},503);
 }
});
