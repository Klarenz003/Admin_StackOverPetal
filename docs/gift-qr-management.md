# Owner-only Gift QR management

Open **Gift QR codes → Preview → Manage card**. Re-enter the signed-in owner's admin login password and type `CONFIRM` for each action. This is not the recipient's letter password.

- **Reset activation:** unused/claimed cards without any attached letter only. Keeps the printed QR token and activation code; clears lifecycle timestamps. Sender activates again.
- **Remove letter & reset:** permanently deletes the linked Gift QR letter and its stored photos, password credentials and remembered sessions. Keeps the physical QR card and activation code, then resets it to unused.
- **Disable this QR:** revokes public QR resolution without deleting the letter.
- **Permanently delete QR & letter:** removes the card and any linked Gift QR letter. Printed QR links stop working. Not recoverable through the application.

## Deploy first

Apply `supabase/migrations/202610060003_gift_qr_owner_actions.sql` to the shared database before deploying the admin UI. Requires the existing owner-only Gift QR schema and `letters.letter_v2_qr_id`. For password-session cleanup, also requires the storefront private gift letters migration. The migration does not modify or remove any existing records.

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
