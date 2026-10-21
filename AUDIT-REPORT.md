# LEGACY v5/v7 Audit Report

Audit date: 2026-10-21  
Scope: the supplied `legacy-backend-starter` v5/v7 files and the gameplay HTML bundled in v7. This is a source-code review, not a live Supabase or mainnet test.

## Executive result

**Not production-ready for a competitive economy or real-money launch.** The game UI and basic flows exist, but several checked roadmap claims are not fully implemented in the code reviewed. Do not accept real-money payments or describe balances/referrals as cheat-resistant until the blockers below are resolved and staging tests pass.

## Findings

### P0 — Browser can set its own game balance

`legacy-account.js` upserts `coins`, `energy`, `power`, `upgrade_cost`, and `last_reward` directly into `player_progress`. `schema.sql` explicitly enables authenticated insert/update policies for that table. A player can modify browser state and sync the altered values. Cloud save exists; server-authoritative balances do not.

**Required fix:** make game state writes server-only. Send authenticated game actions to a server function that validates energy, tap power, upgrade cost, cooldowns, daily reward eligibility, and idempotency before mutating balances. Keep service-role credentials server-side only.

### P0 — Referral reward is client-side

The HTML validates a referral code's format and localStorage flags, then directly adds `+100 LGC`. This does not prove the inviter exists, prevent multi-account abuse, or securely enforce one reward per account.

**Required fix:** store referral codes against accounts and use a server-side, transaction-safe claim function with uniqueness constraints and abuse controls.

### P0 — Wallet ownership is not verified

`linkWallet()` writes a wallet address to `wallet_links` without a signed challenge. A user can associate an address they do not control. Payment verification checks the transaction signer against the address saved in the quote, but that does not prove the account owner controls that wallet.

**Required fix:** implement nonce challenge + wallet signature verification server-side; expire and consume each nonce once.

### P1 — Payment verification is a useful starter, not complete production checkout

The quote stores a fixed amount/recipient/wallet and has an expiry. Verification checks finalized successful transaction, signer, direct transfer recipient/amount, quote age, and calls an atomic SQL RPC. The SQL path protects against reusing a quote/signature.

Gaps: no quote-specific on-chain memo/reference; no live RPC or end-to-end test evidence; no reconciliation worker for a payment that finalized while the browser lost connection; and bundle credit is added to energy capped at 100, which can waste purchased units. Mobile injected-provider fallback is not implemented.

**Required fix:** define bundle semantics, attach a unique reference/memo to each quote and verify it, add retry/reconciliation and support status, test on devnet, and implement tested Phantom mobile handoff.

### P1 — Mission progress and rewards are local-only

Mission counters and claims live in localStorage, and claim buttons directly mutate `state.coins`. This is exploitable and does not provide server-backed daily limits.

**Required fix:** record eligible actions server-side and make mission claims atomic/idempotent in Supabase. Do not trust client-submitted counters.

### P1 — No server-backed leaderboard found

The reviewed HTML includes mission records but no leaderboard query/table/API. A local leaderboard would be spoofable.

**Required fix:** add server-maintained score aggregates and an authenticated/read-only leaderboard endpoint with rate limiting.

### P2 — Account profile limitations

Username metadata is captured on signup, but existing accounts cannot edit their username in the current account UI. No full profile/achievement service was found.

## Gameplay review

The original gameplay is preserved in the v7 HTML: cinematic intro, orb tapping, energy, upgrades, local refill, daily reward, referral panel, bottom navigation, and sound/animation effects. Tap rewards, upgrades, energy regeneration, daily rewards, and mission rewards are still primarily client-side. Therefore this review confirms UI/gameplay presence, not economy integrity.

## Tests actually performed

- Archive listing and file presence check: passed.
- JavaScript syntax check for `index.html` inline script and `legacy-account.js`: to be run by the accompanying QA script in the build environment.
- Supabase SQL migration execution: **not run** (no project credentials/environment).
- Edge Function deployment/integration: **not run**.
- Duplicate payment, failed transaction, recovery, mobile Phantom, and cross-device account tests: **not run** against a live staging project.

## Required release gate

1. Move game economy, referrals, and mission claims behind server-authoritative functions.
2. Verify wallet ownership with signed nonce.
3. Add unique quote reference and payment reconciliation.
4. Deploy to a separate staging Supabase project and use devnet first.
5. Run signup/login/reset, cross-device save, manipulated-state, duplicate-signature, wrong-amount, wrong-recipient, failed-tx, timeout/retry, expired quote, and mobile Phantom test cases.
6. Only mark the checked roadmap items complete when the corresponding test results are recorded.


## v9 UX additions (2026-10-21)
- Added a daily explorer streak indicator. It increments on consecutive daily reward claims, resets after a missed day, and is stored locally. It is a motivation/UI feature only—not a server-verified reward or anti-cheat mechanism.
- Sound preference now persists between visits. Optional vibration feedback is attempted where the browser supports it; unsupported browsers continue normally.
- Improved header wrapping on narrow screens and made the prototype-only status clearer in the missions screen.
- These changes do not resolve the existing production blockers: browser-controlled balances, local mission/referral rewards, unsigned wallet linking, and untested live payment recovery remain unresolved.


## v10 referral update
- Added username-based invite URLs (`?ref=username`), a referred-player count and list UI, a protected referral schema, and a Supabase Edge Function for attaching an authenticated player to a referrer.
- The referral tables are not directly accessible to browser roles; the function validates the caller session and uses service-role credentials server-side.
- This is source-level only until the migration and Edge Function are deployed and tested on the user's Supabase project. No referral reward is granted by the new server-backed flow yet.
