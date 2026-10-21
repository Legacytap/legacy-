/* LEGACY account + Phantom client integration.
 * Configure SUPABASE_URL and SUPABASE_ANON_KEY below after creating your project.
 * Never place a service-role key in this file.
 */
(() => {
"use strict";
const SUPABASE_URL = "https://xchqextkzbycfufvjgqc.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_iQeoanBksIJj3FeJd5gUIA_6IcLxJO9";
const configured = SUPABASE_URL.startsWith("https://") && !SUPABASE_URL.includes("PASTE_") && !SUPABASE_ANON_KEY.includes("PASTE_");
const client = configured && window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;
const $ = id => document.getElementById(id);
let user = null, wallet = null, qty = 3, progressReady = false;
const gate=$("account-gate"), account=$("legacy-account-modal"), buy=$("legacy-buy-modal");
function note(id,msg){const el=$(id);if(el)el.textContent=msg;}
function show(el){el.classList.remove("hidden");}
function hide(el){el.classList.add("hidden");}
function shortAddress(s){return s ? s.slice(0,5)+"…"+s.slice(-5) : "";}
function requireConfig(){if(!client){note("auth-note","Backend not configured yet. Follow SETUP.md and add your Supabase URL and anon key.");return false;}return true;}
function setReferralUsername(u){
 const username=String(u?.user_metadata?.username||"").trim();
 window.legacyUsername=username||"Explorer";
 const el=$("ref-code"); if(el)el.textContent="@"+window.legacyUsername;
 try{if(username)localStorage.setItem("legacy-username",username);}catch(e){}
}
async function refreshReferrals(){
 if(!client||!user)return;
 const {data,error}=await client.functions.invoke("referrals",{body:{action:"list"}});
 if(error||data?.error){const el=$("referral-list-note");if(el)el.textContent="Sign in and deploy the referrals function to view your crew.";return;}
 if(window.legacyRefreshReferralUI)window.legacyRefreshReferralUI(data);
}
window.legacyClaimReferral=async function(username){
 if(!client||!user)throw new Error("Create an account or sign in to record a referral.");
 const {data,error}=await client.functions.invoke("referrals",{body:{action:"claim",username}});
 if(error||data?.error)throw new Error(data?.message||data?.error||error?.message||"Referral could not be recorded.");
 await refreshReferrals(); return data;
};
async function applyPendingReferral(){
 let referral="";try{referral=localStorage.getItem("legacy-pending-referral")||"";}catch(e){}
 if(!referral||!user)return;
 try{await window.legacyClaimReferral(referral);try{localStorage.removeItem("legacy-pending-referral");}catch(e){}note("auth-note","Referral username @"+referral+" submitted successfully.");}
 catch(e){note("auth-note","Referral not recorded: "+e.message+". Check the username and try again.");}
}
async function saveGame(){
 if(!client||!user||!window.state||!progressReady) return;
 const s=window.state;
 const {error}=await client.from("player_progress").upsert({user_id:user.id,coins:Math.floor(s.coins),energy:Math.floor(s.energy),power:Math.floor(s.power),upgrade_cost:Math.floor(s.cost),last_reward:s.lastReward||""},{onConflict:"user_id"});
 if(error) console.error("Progress save failed",error.message);
}
async function loadGame(){
 if(!client||!user||!window.state) return;
 progressReady=false;
 const loadingUserId=user.id;
 const {data,error}=await client.from("player_progress").select("*").eq("user_id",loadingUserId).maybeSingle();
 if(error){console.error("Progress load failed",error.message);return;}
 // A newly registered account has no progress row yet. Never leave the previous
 // account's browser-cached balance visible: start it from clean defaults.
 if(!user||user.id!==loadingUserId)return;
 if(data){
   window.state.coins=Math.max(0,Number(data.coins)||0);
   window.state.energy=Math.min(100,Math.max(0,Number(data.energy)||0));
   window.state.power=Math.max(1,Number(data.power)||1);
   window.state.cost=Math.max(50,Number(data.upgrade_cost)||50);
   window.state.lastReward=String(data.last_reward||"");
 }else{
   Object.assign(window.state,{coins:0,energy:100,power:1,cost:50,lastReward:""});
 }
 if(window.update)window.update();
 if(window.legacySaveLocal)window.legacySaveLocal();
 progressReady=true;
 // Create the account's row now, so future saves always belong to this user.
 if(!data)await saveGame();
}
async function refreshWallet(){
 if(!wallet)return;
 try{
   const connection=new solanaWeb3.Connection("https://api.mainnet-beta.solana.com","confirmed");
   const lamports=await connection.getBalance(new solanaWeb3.PublicKey(wallet));
   $("sol-balance").textContent=(lamports/1e9).toLocaleString(undefined,{maximumFractionDigits:5});
   $("wallet-address").textContent=wallet;
 }catch(e){note("wallet-note","Could not load SOL balance. Try again.");}
}
async function linkWallet(pubkey){
 if(!client||!user)throw new Error("Sign in before linking a wallet.");
 const {error}=await client.from("wallet_links").upsert({user_id:user.id,wallet_address:pubkey},{onConflict:"user_id"});
 if(error)throw error;
 wallet=pubkey;await refreshWallet();
}
async function initSession(){
 if(!client){show(gate);return;}
 const {data:{session}}=await client.auth.getSession();
 user=session?.user||null;
 if(user){setReferralUsername(user);hide(gate);$("account-email").textContent=user.email||"Signed in";$("account-username").textContent="@"+(user.user_metadata?.username||"Explorer");if(!user.user_metadata?.username){show(gate);note("auth-note","Your account has no username yet. Username editing for existing accounts is not yet available.");}await applyPendingReferral();await loadGame();await refreshReferrals();}
 else show(gate);
}
function setAuthMode(mode){
 const isLogin=mode==="login";
 $("auth-referral").classList.toggle("hidden",isLogin);
 $("auth-title").textContent=isLogin?"WELCOME BACK":"CREATE YOUR ACCOUNT";
 $("auth-description").textContent=isLogin?"Log in with the email and password for your LEGACY account.":"Your progress will be tied to your account, not just this browser.";
 $("auth-username").classList.toggle("hidden",isLogin);
 $("auth-username").required=!isLogin;
 $("auth-password").autocomplete=isLogin?"current-password":"new-password";
 $("auth-signup").classList.toggle("hidden",isLogin);
 $("auth-login").classList.toggle("hidden",!isLogin);
 $("auth-show-login").classList.toggle("hidden",isLogin);
 $("auth-show-signup").classList.toggle("hidden",!isLogin);
 $("auth-reset").classList.toggle("hidden",!isLogin);
 note("auth-note","");
}
$("auth-show-login").addEventListener("click",()=>setAuthMode("login"));
$("auth-show-signup").addEventListener("click",()=>setAuthMode("signup"));
$("auth-signup").addEventListener("click",async()=>{
 if(!requireConfig())return;
 const email=$("auth-email").value.trim(),password=$("auth-password").value, username=$("auth-username").value.trim(), referralUsername=$("auth-referral").value.trim().replace(/^@/,"");
 if(referralUsername && !/^[a-zA-Z0-9_]{3,20}$/.test(referralUsername))return note("auth-note","Referral username must be 3–20 letters, numbers, or underscores.");
 if(referralUsername)try{localStorage.setItem("legacy-pending-referral",referralUsername);}catch(e){}
 if(!/^[a-zA-Z0-9_]{3,20}$/.test(username))return note("auth-note","Choose a username of 3–20 letters, numbers, or underscores.");
 if(!email||password.length<8)return note("auth-note","Enter a valid email and a password of at least 8 characters.");
 const {data,error}=await client.auth.signUp({email,password,options:{data:{username}}});
 note("auth-note",error?error.message:(data.session?"Account created.":"Check your email to confirm your account, then log in."));
 if(data.session){user=data.user;setReferralUsername(user);hide(gate);$("account-email").textContent=user.email;$("account-username").textContent="@"+(user.user_metadata?.username||username);await applyPendingReferral();await loadGame();await refreshReferrals();}
});
$("auth-login").addEventListener("click",async()=>{
 if(!requireConfig())return;
 const {data,error}=await client.auth.signInWithPassword({email:$("auth-email").value.trim(),password:$("auth-password").value});
 if(error)return note("auth-note",error.message);
 user=data.user;setReferralUsername(user);hide(gate);$("account-email").textContent=user.email||"Signed in";$("account-username").textContent="@"+(user.user_metadata?.username||"Explorer");if(!user.user_metadata?.username){show(gate);note("auth-note","Set a username by creating a new account; username editing is not yet available for existing accounts.");}await applyPendingReferral();await loadGame();await refreshReferrals();
});
$("auth-reset").addEventListener("click",async()=>{
 if(!requireConfig())return;
 const email=$("auth-email").value.trim();if(!email)return note("auth-note","Enter your email first.");
 const {error}=await client.auth.resetPasswordForEmail(email,{redirectTo:location.origin+location.pathname});
 note("auth-note",error?error.message:"If the email exists, a password reset link has been sent.");
});
$("account-open").addEventListener("click",()=>{if(!user)return show(gate);$("account-email").textContent=user.email||"Signed in";show(account);if(wallet)refreshWallet();});
$("account-close").addEventListener("click",()=>hide(account));
$("auth-recovery").addEventListener("click",()=>{$("auth-email").value=user?.email||"";hide(account);show(gate);setAuthMode("login");note("auth-note","Enter your account email and request a reset link.");});
$("auth-logout").addEventListener("click",async()=>{
 progressReady=false;
 if(client){const {error}=await client.auth.signOut();if(error){console.error("Logout failed",error.message);note("auth-note","Could not log out. Please try again.");return;}}
 user=null;wallet=null;
 if(window.state){Object.assign(window.state,{coins:0,energy:100,power:1,cost:50,lastReward:""});if(window.update)window.update();if(window.legacySaveLocal)window.legacySaveLocal();}
 $("account-email").textContent="";$("account-username").textContent="";
 hide(account);show(gate);setAuthMode("login");
});
$("wallet-connect").addEventListener("click",async()=>{
 try{
  if(!window.phantom?.solana?.isPhantom)throw new Error("Phantom was not found. Open LEGACY in a browser with Phantom installed.");
  const resp=await window.phantom.solana.connect();
  await linkWallet(resp.publicKey.toString());
  note("wallet-note","Phantom connected and linked to your LEGACY account.");
 }catch(e){note("wallet-note",e.message||"Wallet connection failed.");}
});
$("wallet-disconnect").addEventListener("click",async()=>{
 try{if(window.phantom?.solana)await window.phantom.solana.disconnect();}catch(e){}
 wallet=null;$("wallet-address").textContent="No Phantom wallet connected";$("sol-balance").textContent="—";
 if(client&&user)await client.from("wallet_links").delete().eq("user_id",user.id);
 note("wallet-note","Wallet disconnected.");
});
document.querySelectorAll("[data-qty]").forEach(b=>b.addEventListener("click",()=>{qty=Number(b.dataset.qty);document.querySelectorAll("[data-qty]").forEach(x=>x.classList.toggle("selected",x===b));note("buy-quote",`${qty} refills · ${(qty/3*0.0069).toFixed(4)} SOL. The server will create the payment quote.`);}));
$("paid-refill").addEventListener("click",()=>{if(!user){show(gate);note("auth-note","Create an account or log in before buying refills.");return;}show(buy);});
$("buy-close").addEventListener("click",()=>hide(buy));
$("buy-confirm").addEventListener("click",async()=>{
 note("buy-note","Payments go to HHK8EsvfLt6gvCMqjRWZ8tcJj5qr7MQ7NihNbCg5xKAE on Solana.");
 try{
  if(!client||!user)throw new Error("Sign in first.");
  if(!window.phantom?.solana?.isPhantom)throw new Error("Install/open Phantom before purchasing.");
  if(!wallet){const r=await window.phantom.solana.connect();await linkWallet(r.publicKey.toString());}
  // Quote and payment are server controlled. The Edge Function must reject wrong
  // recipients, wrong amounts, failed transactions and replayed signatures.
  const {data:quote,error:qerr}=await client.functions.invoke("create-sol-quote",{body:{refills:qty}});
  if(qerr||!quote?.recipient||!quote?.lamports||!quote?.quote_id)throw new Error(qerr?.message||"Payment quote service is not configured.");
  const provider=window.phantom.solana;
  const connection=new solanaWeb3.Connection("https://api.mainnet-beta.solana.com","confirmed");
  const from=new solanaWeb3.PublicKey(provider.publicKey.toString());
  const to=new solanaWeb3.PublicKey(quote.recipient);
  const tx=new solanaWeb3.Transaction().add(solanaWeb3.SystemProgram.transfer({fromPubkey:from,toPubkey:to,lamports:Number(quote.lamports)}));
  tx.feePayer=from;tx.recentBlockhash=(await connection.getLatestBlockhash()).blockhash;
  const signed=await provider.signAndSendTransaction(tx);
  const signature=typeof signed==="string"?signed:signed.signature;
  note("buy-note","Transaction sent. Waiting for server verification…");
  const {data:result,error:verr}=await client.functions.invoke("verify-sol-payment",{body:{signature,quote_id:quote.quote_id}});
  if(verr||!result?.success)throw new Error(verr?.message||result?.error||"Payment is not verified yet. Do not pay again; check transaction status.");
  note("buy-note",`Payment verified. ${result.refills} refills credited.`);
  if(typeof window.legacyRecordRefill==="function")window.legacyRecordRefill();
  hide(buy);await loadGame();
 }catch(e){note("buy-note",e.message||"Purchase could not be completed.");}
});
if(client){
 client.auth.onAuthStateChange((_event,session)=>{user=session?.user||null;});
 // The main game uses lexical state; expose controlled access for account sync.
 const timer=setInterval(()=>{if(user&&progressReady)saveGame();},15000);
 window.addEventListener("beforeunload",()=>{if(user&&progressReady)saveGame();});
}
setAuthMode("signup");
initSession();
})();
