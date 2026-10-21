# LEGACY Web Build v10 — Username Referrals

This package contains the current web-only game, daily streak UX, persistent sound preference, mobile layout polish, progressive missions, and an audit/QA checklist. It is a **test/staging build**, not a production-certified release and is not automatically deployed to GitHub Pages or Supabase. Read `AUDIT-REPORT.md` and `QA-CHECKLIST.md` before deployment.

## Included
- Source audit report documenting verified gaps and release blockers.
- Daily explorer streak display (consecutive daily reward claims; local prototype only).
- Sound preference remembered between visits, optional tap haptics where browser support exists, and improved narrow-screen header wrapping.
- Clearer prototype warning explaining that local balances, missions, streaks and referral claims are editable.
- Staging QA checklist and static smoke-test script (`node qa-check.js`).
- Existing LEGACY cinematic intro and tap gameplay.
- Username field for new signups, email/password sign-in, email password reset UI.
- Supabase progress load/save starter integration.
- Username-based invite links (`?ref=username`) and a referred-player count/list UI. Referral attribution is recorded by the `referrals` Edge Function after the invited player signs in and submits the inviter username. No referral LGC bonus is issued by this new server-backed flow yet.
- Phantom wallet connection/balance display and refill checkout UI.
- Server quote + transaction verification starter with atomic SQL payment credit function.
- Progressive daily missions: three tap stages (100 / 350 / 800 taps), three stardust stages (500 / 1,800 / 4,500 LGC earned from tapping), two upgrade stages (2 / 5 upgrades), plus daily-reward and optional refill objectives. Later stages unlock only after claiming the previous stage; rewards increase with difficulty.
- Mission progress counters and an explorer record panel.
- Fixed refill pricing: 3 = 0.0069 SOL; 6 = 0.0138; 9 = 0.0207; 12 = 0.0276; 30 = 0.0690; 60 = 0.1380.

## Mission limitations
Mission progress and claims are currently stored in the browser's localStorage. This is suitable only for prototyping; users can manipulate local browser data. Before a public competitive launch, move mission progress, eligibility, and reward crediting to authenticated server-side functions and ensure reward claims are idempotent.

## Deploy
1. Run `supabase/schema.sql` in your Supabase SQL editor.
2. Run `supabase/referrals.sql` in the Supabase SQL editor to create the protected profile/referral tables.
3. Deploy `supabase/functions/referrals/index.ts` as the `referrals` Edge Function. It uses the existing Supabase secrets and service-role key server-side only.
4. Configure the Supabase URL and anon key in `legacy-account.js`.
5. Configure Auth site/redirect URLs and email delivery in Supabase.
6. Deploy `supabase/functions/create-sol-quote/index.ts` and `supabase/functions/verify-sol-payment/index.ts` as their respective Edge Functions.
7. Set secrets: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SOLANA_RPC_URL`, `LEGACY_SOL_RECEIVER`.
8. `LEGACY_SOL_RECEIVER` should be the public receiving wallet: `HHK8EsvfLt6gvCMqjRWZ8tcJj5qr7MQ7NihNbCg5xKAE`.
9. Upload `index.html` and `legacy-account.js` together to the same GitHub Pages directory.

## Must be finished before real-money/public launch
- Implement cryptographic wallet ownership linking (signed nonce challenge).
- Add a unique on-chain memo/reference per payment quote and verify it; current quote-time matching is not enough to eliminate every ambiguous payment.
- Implement mobile Phantom deep-link / Solana Pay fallback for Safari and Chrome; injected Phantom provider works best in Phantom's in-app browser or compatible desktop extension.
- Move all game economy and mission reward writes behind server-side functions; current client-side progress writes can be manipulated.
- If referral rewards are enabled later, add a server-side, idempotent reward rule; do not credit LGC in browser code. Ensure each username is unique in `player_profiles`.
- Add server-backed leaderboard, account/profile editing, admin tools, privacy/terms/support pages, analytics, monitoring and backup/recovery procedures.
- Clarify refill semantics: the current credit path increments energy up to 100, so buying while nearly full may waste units. Decide whether a bundle represents energy points or full refill charges and implement that rule before taking payment.
- Test signup, email confirmation, password reset, persistence, mission reset, duplicate/failed payments and recovery on a staging project. Start with devnet and only then controlled mainnet tests.

Never expose the Supabase service-role key in frontend code and never ask players for wallet seed phrases or private keys. This package is not yet safe to treat as a real-money production launch.

## Username referrals
- Invite links use `?ref=username` and the UI displays the count and usernames returned by the protected Edge Function.
- Players must be signed in, and the inviter username must correspond to a profile already registered through the function. The invited player then presses the claim button to attach the referral to their account.
- Referral table access is revoked from browser roles; the Edge Function uses service-role credentials on the server. The referrer sees usernames and join dates only, not invitees’ emails.
- This has not been tested against your live Supabase project. Run the SQL and deploy the function before expecting the list to populate.
