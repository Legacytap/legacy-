// Static smoke checks for the LEGACY package. Run: node qa-check.js
const fs = require('node:fs');
const vm = require('node:vm');
const html = fs.readFileSync('index.html', 'utf8');
const account = fs.readFileSync('legacy-account.js', 'utf8');
const inline = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map(m => m[1]).filter(s => s.trim());
let failed = false;
function check(label, fn) {
  try { fn(); console.log(`PASS ${label}`); }
  catch (e) { failed = true; console.error(`FAIL ${label}: ${e.message}`); }
}
check('index.html contains game shell', () => { if (!html.includes('id="game-orb"') || !html.includes('id="tab-earn"')) throw Error('missing core gameplay UI'); });
check('daily streak UI and persistence present', () => { if (!html.includes('legacy-daily-streak-v1') || !html.includes('claimStreakDay') || !html.includes('id=\"streak-count\"')) throw Error('streak feature incomplete'); });
check('sound preference persists', () => { if (!html.includes('legacy-sound-enabled')) throw Error('sound preference is not persisted'); });
check('prototype economy warning is visible', () => { if (!html.includes('balances, missions, streaks and referral claims are stored on this device')) throw Error('prototype warning missing'); });
check('username referral UI and invite links present', () => { if (!html.includes('id="referral-count"') || !html.includes('id="referral-list"') || !html.includes('searchParams.set("ref", myReferralCode)')) throw Error('username referral UI missing'); });
check('server referral function and schema present', () => { if (!fs.existsSync('supabase/functions/referrals/index.ts') || !fs.existsSync('supabase/referrals.sql')) throw Error('referral backend files missing'); });
check('account integration file present', () => { if (!account.includes('create-sol-quote') || !account.includes('verify-sol-payment')) throw Error('payment flow functions missing'); });
check('no service-role key in browser JS', () => { if (/SUPABASE_SERVICE_ROLE_KEY|service_role\s*[:=]/i.test(account)) throw Error('possible service-role secret in browser code'); });
check('inline JavaScript parses', () => { for (const [i, s] of inline.entries()) new vm.Script(s, {filename: `index-inline-${i}.js`}); });
check('account JavaScript parses', () => { new vm.Script(account, {filename:'legacy-account.js'}); });
check('setup warns against production use', () => { const s = fs.readFileSync('SETUP.md','utf8'); if (!/not yet safe|not production|not.*production/i.test(s)) throw Error('missing staging warning'); });
if (failed) process.exitCode = 1;
