# Owner-only Gift QR management

Open **Gift QR codes → Preview → Manage card**. Re-enter the signed-in owner's admin login password and type `CONFIRM` for each action. This is not the recipient's letter password.

- **Reset activation:** unused/claimed cards without any attached letter only. Keeps the printed QR token and activation code; clears lifecycle timestamps. Sender activates again.
- **Remove letter & reset:** permanently deletes the linked Gift QR letter and its stored photos, password credentials and remembered sessions. Keeps the physical QR card and activation code, then resets it to unused.
- **Disable this QR:** revokes public QR resolution without deleting the letter.
- **Reactivate QR:** revoked cards only. Restores published when a valid published Gift QR letter is still linked, claimed when there is no letter but a claim timestamp exists, otherwise unused. Clears only the revocation timestamp; keeps the letter, photos, password, remembered sessions and printed card credentials. Inconsistent/dangling links are rejected for review. Remembered recipient browsers may unlock again automatically, subject to normal session expiry.
- **Renew / transfer to a new QR:** a published or revoked card with a valid password-protected letter only. Generates a fresh QR token and activation code, moves the same letter to the new card and marks the old card replaced. Opens the new print preview after completion. The new card is unused until its own activation code is entered; activation opens the existing letter, not the composer. All letter content, password credentials, management token and remembered sessions remain unchanged. The old printed QR no longer resolves. Existing bookmarks to the letter do not work while the new card is awaiting activation but may work again after activation, using the same letter password/session. This is not a password compromise remedy and does not retract content already viewed or saved.
- **Permanently delete QR & letter:** removes the card and any linked Gift QR letter. Printed QR links stop working. Not recoverable through the application.

## Deploy first

Apply `supabase/migrations/202610060003_gift_qr_owner_actions.sql` to the shared database before deploying the admin UI. Requires the existing owner-only Gift QR schema and `letters.letter_v2_qr_id`. For password-session cleanup, also requires the storefront private gift letters migration. The migration does not modify or remove any existing records.

For **Reactivate QR**, then apply `supabase/migrations/202610060004_gift_qr_reactivation.sql`. Always apply these in order; rerunning 003 after 004 replaces the RPC with the older version, so reapply 004 afterward. Neither migration reactivates records on its own.

For renewal, apply `supabase/migrations/202610060005_gift_qr_renewal.sql` next, before releasing BOTH the admin and storefront activation-page changes. This migration owns the updated shared activation RPC and repeats the renewal-safe management function, so previously deployed versions of 004 are upgraded too. Reapply 005 last if older migrations are run again. The renewed letter remains gated if its new QR is revoked/reactivated before first activation. Both applications use the same Supabase database; no production mutations are performed by the test scripts or builds.

Direct authenticated QR updates/deletes and Gift QR letter deletes are blocked by restrictive RLS policies. Creation, reading, printing and customer claim/publish RPCs remain unchanged. No arbitrary status dropdown can mark an unpublished card published or turn a published card unused.

The management RPC checks owner market `ALL`, a live Supabase session and a signed password authentication timestamp within 120 seconds. It consumes one successful action per authentication session, recorded in a private audit table without passwords, activation codes or letter content. Refreshing a token does not make an old password authentication fresh. The UI uses a separate non-persistent client, confirms the same user ID, and signs out that temporary session without replacing the dashboard login. No service-role key or admin password goes into the management RPC.

The `ALL` designation is the existing owner authority: only assign it to the actual owner. Accounts without an admin login password must establish one through the normal secure account flow first.

Authentication fields are based on the official [Supabase JWT claims reference](https://supabase.com/docs/guides/auth/jwt-fields) (`amr.method`, `amr.timestamp`, `session_id`).

All changes are transactional and lock the target QR. Reset refuses published/revoked/replaced cards or any card with a letter. Destructive operations refuse a link to an unrelated checkout letter. Removing a letter does not remove media copies outside the database, previously downloaded files or photos retained by recipients. Password-protected inline images are deleted with the letter.

## Verification

`npm run build` type-checks the admin UI. Isolated SQL/security tests (no live data):

```sh
node scripts/check-gift-qr-management.cjs <temporary-directory-with-embedded-postgres-installed>
```

This harness covers owner/staff/anonymous boundaries, old and non-password authentication, missing sessions, one-action replay prevention, direct REST mutation blocks, reset preconditions, revoke preserving letters, letter removal and credential/session cascades, permanent QR deletion, checkout-letter isolation and reapplying the migration. It uses stub Supabase JWT/session helpers, so staging should additionally verify real password sign-in, cancel/wrong-password handling and mobile dialog navigation.
