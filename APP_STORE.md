# App Store submission checklist

What the code already covers, and what has to be done by hand in App Store
Connect. Work through the second list before pressing Submit.

## Covered in the code

| Guideline | What it asks | Where it is handled |
| --- | --- | --- |
| 5.1.1(i) Privacy policy | Link in App Store Connect **and** inside the app | `PRIVACY.md`, linked from Settings → About and from the consent screen (`src/links.ts`) |
| 5.1.1(ii) Permission | Consent for data collection, easy to withdraw | Consent screen before the first recording (`app/practice.tsx`), Withdraw in Settings → Privacy |
| 5.1.2(i) Third-party AI | Disclose where personal data goes, including third-party AI, and get explicit permission first | Consent screen names the service and what is sent; nothing is recorded or uploaded until "Agree and continue" |
| 5.1.1(i) Deletion | Explain retention and how to delete | Long-press delete in Talks, "Delete all talks and recordings" in Settings, policy text |
| 5.1.1(v) Account deletion | An app that lets people create an account must let them delete it in the app | Settings → Account → Delete account, confirmed, calls the `delete_user` function in `supabase/schema.sql`, which removes the user and all server data |
| 4.8 Sign in with Apple | Offered whenever a third-party login is offered; equivalent, privacy-respecting | Native Sign in with Apple button on the auth screen (`expo-apple-authentication`), email relay accepted; accounts are optional so no screen is gated on login |
| 5.1.1(ii) Account optional | Do not require account creation unless the app's core features need it | Every feature works signed out; the auth screen says so and Settings shows "Sign in or create account" only as an option |
| 1.2 / 4.7 AI content | Report mechanism and published contact | "Report a problem" link under the coach card and in Settings → About (GitHub issues); the coach prompt forbids remarks about the person |
| 5.1.1(ii) Purpose strings | Explain the microphone use | `NSMicrophoneUsageDescription` in `app.json` says what is recorded and that it is only sent after agreement |
| Privacy manifest | Declare collected data and required-reason APIs | `ios.privacyManifests` in `app.json`: Audio Data (not linked), Email Address and User ID (linked to the account, app functionality, not tracking) |
| Export compliance | `ITSAppUsesNonExemptEncryption` | `ios.config.usesNonExemptEncryption: false` (HTTPS only) |
| 2.1 Completeness | No placeholders, handles no network and denied permission | Offline error text, "Open Settings" when the microphone is denied, empty states on every tab |
| iPad | Orientation rules for multitasking | All four iPad orientations are declared; the layout is a single column that scales |
| Accessibility | VoiceOver labels | Every tappable element has a role and label |

## To do in App Store Connect

1. **Apple Developer Program.** A free Apple ID can only sideload for 7 days.
   Submitting needs the paid programme (99 USD/year) and an App ID for
   `com.mindtomouth.app`.
2. **Build and upload with EAS**: `npx eas-cli@latest build --platform ios
   --profile production` then `npx eas-cli@latest submit --platform ios`.
   The `.env` key must be present where the build runs (an EAS secret named
   `EXPO_PUBLIC_NVIDIA_API_KEY`). Bump `ios.buildNumber` in `app.json` for every
   upload.
3. **Sign in with Apple capability.** In the Apple Developer portal, under
   Identifiers → the `com.mindtomouth.app` App ID, tick *Sign In with Apple*.
   `ios.usesAppleSignIn` in `app.json` adds the entitlement to the build, but
   the App ID must have the capability or the upload is rejected. EAS does this
   for you when it manages credentials.
4. **Supabase project** (free tier): create one at <https://supabase.com>, then
   - Project Settings → API: copy the project URL and the anon (publishable)
     key into `.env` as `EXPO_PUBLIC_SUPABASE_URL` and
     `EXPO_PUBLIC_SUPABASE_ANON_KEY` (and as EAS secrets for cloud builds). A
     build without them has no Account section at all.
   - Authentication → Providers → Email: keep it on. "Confirm email" may stay on;
     the app handles the confirmation link. Set the site URL to
     `mindtomouth://auth/callback` and add `mindtomouth://**` under Redirect URLs.
   - Authentication → Providers → Apple: enable it and put `com.mindtomouth.app`
     in *Client IDs*. Native iOS sign-in needs no Services ID or secret key.
   - SQL Editor: run `supabase/schema.sql` once. It creates the `delete_user`
     function that "Delete account" calls; without it deletion fails with a
     message pointing here.
   - Authentication → Emails: the built-in sender allows only a handful of
     emails per hour and lands in spam often. Before launch, add a custom SMTP
     provider (Resend, Postmark, ...) and set the sender to a domain you own.
5. **Privacy policy URL**: `https://github.com/ufukceyhanli/mind-to-mouth/blob/main/PRIVACY.md`
   (the repo must stay public, or move the page to a site you control and update
   `src/links.ts`).
6. **Support URL**: `https://github.com/ufukceyhanli/mind-to-mouth/issues`.
7. **App Privacy (nutrition label)**: answer "Yes, we collect data". Add
   **Audio Data** under User Content: used for App Functionality, not linked to
   the user's identity, not used for tracking. Add **Email Address** (Contact
   Info) and **User ID** (Identifiers): App Functionality, linked to the user,
   not used for tracking. Add **Name** (Contact Info, linked) only if you keep
   the name Apple shares on first sign-in (the app does, as `full_name` in the
   user metadata). Say "No" to tracking.
8. **Age rating questionnaire**: no objectionable content categories apply. The
   2025 questionnaire asks about AI features; answer that the app contains
   AI-generated feedback shown only to the user. Expected rating 4+.
9. **Category**: Education (secondary: Productivity).
10. **Screenshots**: 6.9-inch iPhone set is required; a 13-inch iPad set is
   required while `ios.supportsTablet` is true. Show the Today tab, the word
   reveal, the recording screen, a result and the Talks list. No splash or
   login screens.
11. **Notes for Review**: paste this, and fill in a demo account you created
    in the Supabase dashboard (Authentication → Users → Add user, with
    "Auto confirm" on). Apple asks for one whenever an app has a login.

    > No account is needed. Tap "Today's talk", agree to the data-sharing notice,
    > allow the microphone, and speak for about a minute. The recording is sent
    > to NVIDIA's AI model service for transcription and coaching; the consent
    > screen and Settings → Privacy explain this and allow withdrawal. Scoring
    > needs a network connection. Feedback is AI-generated and labelled as such.
    > Optional sign-in (Settings → Account) with Sign in with Apple or email;
    > demo account: EMAIL / PASSWORD. Delete account is under Settings → Account.
    > No in-app purchases.

12. **Test on a real device via TestFlight** before review. Apple emails about a
    missing privacy-manifest reason within minutes of upload; add any reported
    code under `ios.privacyManifests` and upload again.

## Known gap: revoking Apple tokens on account deletion

Guideline 5.1.1(v) also asks apps that offer Sign in with Apple to revoke the
user's Apple token (the `Sign in with Apple REST API`, `/auth/revoke`) when the
account is deleted. That call needs the team's private key and a server, so the
client cannot make it. Deleting the Supabase user removes the account; the
Apple-side grant stays listed under the user's Apple ID → Sign in with Apple
until they remove it, and the next Sign in with Apple creates a fresh account.
Before a public launch, add a Supabase Edge Function that revokes the token and
call it from `deleteAccount` in `src/auth/AuthProvider.tsx`.

## Known risk: the bundled access key

The service key is compiled into the app from `.env`. Anyone who unpacks the
IPA can read it and spend against the account. Apple does not reject apps for
this, but before a public release either put a small proxy with rate limits in
front of the service or set a hard spending cap on the key.
