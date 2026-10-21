# LEGACY Staging QA Checklist

Do not test with real funds first. Use a separate Supabase staging project and Solana devnet.

## Account and cloud save
- [ ] Signup with a new email and valid username.
- [ ] Confirm email; login; logout; login again.
- [ ] Request password reset and complete the redirect flow.
- [ ] Change progress on device A; log in on device B; verify expected sync behavior.
- [ ] Edit `localStorage` coins/energy/power manually. The server must reject any attempt to mint balance.
- [ ] Try direct REST insert/update against `player_progress`; writes should be denied once server-authoritative actions are deployed.

## Game economy and referrals
- [ ] Tap with zero energy; balance must not increase.
- [ ] Submit forged tap counts and oversized action batches; server rejects them.
- [ ] Buy upgrade with insufficient balance; server rejects it.
- [ ] Claim daily reward twice concurrently; only one credit occurs.
- [ ] Claim same mission twice concurrently; only one reward occurs.
- [ ] Use invalid, self, already-used, and cross-account referral codes.
- [ ] Attempt referral reward from multiple accounts/devices; server policy prevents duplicate abuse.

## Phantom/payment
- [ ] Wallet link is accepted only after a valid signature over a fresh server nonce.
- [ ] Wrong wallet signature, expired nonce, and reused nonce are rejected.
- [ ] Valid devnet payment is credited once.
- [ ] Duplicate verification request returns the prior result without a second credit.
- [ ] Wrong recipient, wrong amount, wrong signer, failed transaction, unfinalized transaction, old transaction, expired quote, and reused quote are rejected.
- [ ] Browser closes after chain confirmation; retry/reconciliation credits the same payment once.
- [ ] User cancels Phantom approval; no credit is issued and UI remains usable.
- [ ] Test Phantom mobile browser and ordinary Safari/Chrome handoff paths.
- [ ] Confirm energy/refill bundle semantics do not silently discard paid units.

## Operations
- [ ] Verify logs contain no secrets, seed phrases, or private keys.
- [ ] Verify service-role key is only configured as a server secret.
- [ ] Verify rate limits, alerts, database backup, and restore procedure.
- [ ] Record test date, build hash, tester, environment, and pass/fail evidence before changing roadmap checkboxes.


## v9 UX regression checks
- [ ] Claim daily reward once; streak becomes 1 and daily button disables.
- [ ] Reload the page; streak and sound preference remain visible.
- [ ] Simulate the next calendar day and claim; streak increments by one. Skip a day and confirm the streak resets to one on the next claim.
- [ ] On a narrow phone viewport, confirm the header wraps without overlapping the account button or sound toggle.
- [ ] Verify tap feedback still works when sound is off and vibration is unsupported.
