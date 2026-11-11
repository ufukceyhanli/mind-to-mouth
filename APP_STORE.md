# App Store submission checklist

What the code already covers, and what has to be done by hand in App Store
Connect. Work through the second list before pressing Submit.

## Covered in the code

| Guideline | What it asks | Where it is handled |
| --- | --- | --- |
| 5.1.1(i) Privacy policy | Link in App Store Connect **and** inside the app | `PRIVACY.md`, published at <https://mind-to-mouth.web.app/privacy> by the site in `website/`, linked from Profile → About and from the consent screen (`src/links.ts`) |
| 5.1.1(ii) Permission | Consent for data collection, easy to withdraw | Consent screen before the first recording (`app/practice.tsx`), Withdraw in Profile → About |
| 5.1.2(i) Third-party AI | Disclose where personal data goes, including third-party AI, and get explicit permission first | Consent screen says audio goes to a third-party AI service and what is sent; nothing is recorded or uploaded until "Agree and continue". Vendors are deliberately not named anywhere public (the guideline asks for disclosure, not names); the policy offers the names on request |
| 5.1.1(i) Deletion | Explain retention and how to delete | Swipe-left or long-press delete in Talks, "Delete talk" on a talk's screen, "Delete all talks and recordings" in Profile → About, policy text |
| 5.1.1(v) Account deletion | An app that lets people create an account must let them delete it in the app | Profile → Account → Delete account, confirmed, calls the `delete_user` function in `supabase/schema.sql`, which removes the user and all server data |
| 4.8 Sign in with Apple | Offered whenever a third-party login is offered; equivalent, privacy-respecting | Native "Continue with Apple" button (`expo-apple-authentication`) next to Google on the create-account and sign-in screens, email relay accepted |
| 5.1.1(ii) Account required | Account creation may only be required when the app's core features need it | The app requires an account before anything else (welcome → create account or sign in). Be ready to explain in Review Notes why the core features need it, or Apple may push back |
| 1.2 / 4.7 AI content | Report mechanism and published contact | "Report a problem" link under the coach card and "Contact" in Profile → About open the support page (or the support mailbox once `SUPPORT_EMAIL` in `src/links.ts` and `website/build.mjs` is set); the coach prompt forbids remarks about the person. The repository is private, so nothing user-facing may link to it |
| 5.1.1(ii) Purpose strings | Explain the microphone use | `NSMicrophoneUsageDescription` in `app.json` says what is recorded and that it is only sent after agreement |
| Privacy manifest | Declare collected data and required-reason APIs | `ios.privacyManifests` in `app.json`: Audio Data (not linked), Email Address and User ID (linked to the account, app functionality, not tracking) |
| Export compliance | `ITSAppUsesNonExemptEncryption` | `ios.config.usesNonExemptEncryption: false` (HTTPS only) |
| 3.1.1 In-app purchase | Digital features must be sold through Apple's in-app purchase | Mind to Mouth Plus is an auto-renewable subscription bought with StoreKit (`expo-iap`, `src/plan/PlanProvider.tsx`). No other payment path exists |
| 3.1.2 Subscriptions | Paywall shows name, length, price, what you get; restore; links to terms and privacy; ongoing value | `app/plus.tsx`: "Mind to Mouth Plus", monthly, the App Store's localised price, three benefits, auto-renew wording, **Restore purchases**, Terms of use (Apple's standard EULA) and Privacy policy links. The free plan keeps working without it |
| 3.1.2(a) Manage | Tell people how to manage and cancel | Profile → Plan → Manage opens the App Store subscription settings; support page `#cancel`; the delete-account prompt says the subscription is not cancelled by it |
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
     build without them cannot sign anyone in, so it stops at the welcome screen. **After any change to
     `.env`, clear Metro's cache before building** (`rm -rf "$TMPDIR/metro-cache"`,
     or `npx expo start --clear` once): `EXPO_PUBLIC_*` values are inlined at
     transform time and the cache is keyed on source only, so a rebuild can
     ship stale values. The cache is shared by every checkout on the machine.
   - Authentication → Providers → Email: keep it on. "Confirm email" may stay on;
     the app handles the confirmation link. Set the site URL to
     `mindtomouth://auth/callback` and add `mindtomouth://**` under Redirect URLs.
   - Authentication → Providers → Apple: enable it and put `com.mindtomouth.app`
     in *Client IDs*. Native iOS sign-in needs no Services ID or secret key.
   - Authentication → Providers → Google: enable it with an OAuth client ID and
     secret from Google Cloud (APIs & Services → Credentials, type *Web
     application*, with Supabase's callback URL from this page as an authorised
     redirect URI). The app opens Google in the system browser and comes back on
     `mindtomouth://auth/callback`, which the Redirect URLs above already allow.
     Until this is done, "Continue with Google" shows "not set up yet".
   - SQL Editor: run `supabase/schema.sql` once. It creates the `delete_user`
     function that "Delete account" calls; without it deletion fails with a
     message pointing here.
   - Authentication → Emails: the built-in sender allows only a handful of
     emails per hour and lands in spam often. Before launch, add a custom SMTP
     provider (Resend, Postmark, ...) and set the sender to a domain you own.
5. **Mind to Mouth Plus subscription.** Until this exists the paywall shows a
   greyed-out button and "The App Store did not answer".
   - **Agreements, Tax, and Banking**: accept the *Paid Apps* agreement and fill
     in bank and tax details. Products cannot be sold, or even loaded in
     TestFlight, before this is active.
   - **Subscriptions** (under the app → Monetization): create a subscription
     group, e.g. "Mind to Mouth Plus", then one subscription in it with
     **Product ID `com.mindtomouth.app.plus.monthly`** (it must match
     `PLUS_PRODUCT_ID` in `src/plan/limits.ts`), duration **1 month**.
   - **Price**: USD 4.90 as the base; let App Store Connect generate the other
     countries. The app always shows the price the App Store returns.
   - **Localization**: display name "Mind to Mouth Plus", description
     "Unlimited talks, pronunciation check and longer talks."
   - **Review information**: a screenshot of the paywall (`app/plus.tsx`) and a
     note: "Opened from Profile → Plan, or from Today once the three free
     talks of the week are used."
   - Optional: an **introductory offer** of 7 days free. The paywall picks it
     up by itself ("Start free trial", "7 days free, then …") and only shows
     it to Apple Accounts that are still eligible.
   - The first subscription has to be submitted **together with an app
     version**: on the version page, under *In-App Purchases and
     Subscriptions*, add it before pressing Submit.
   - **App description**: because the app uses Apple's standard licence
     agreement, add this line at the end of the description (guideline 3.1.2
     asks for a terms link in the metadata):
     `Terms of use: https://www.apple.com/legal/internet-services/itunes/dev/stdeula/`
   - **Testing**: create a Sandbox tester (Users and Access → Sandbox) and buy
     on a device build, or use TestFlight, where subscriptions are free and
     renew every few minutes. The simulator cannot load real products.
   - Personal builds made before the product exists can set
     `EXPO_PUBLIC_PLUS_UNLOCKED=1` in `.env` to skip the free plan's limits.
     **Never set it as an EAS secret**: a store build with it gives Plus away.
6. **Privacy policy URL**: `https://mind-to-mouth.web.app/privacy`. The page is
   the static site in `website/`, deployed to Firebase Hosting by the GitHub
   Actions workflow on every push to `main`; `website/README.md` has the
   one-time console setup (Firebase project plus one GitHub secret). Deploy it
   **before** submitting: App Review opens the link.
7. **Support URL**: `https://mind-to-mouth.web.app/support`. The same page
   explains account deletion (`/support#delete-account`), which Google Play
   also asks for if the app ever ships there.
8. **App Privacy (nutrition label)**: answer "Yes, we collect data". Add
   **Audio Data** under User Content: used for App Functionality, not linked to
   the user's identity, not used for tracking. Add **Email Address** (Contact
   Info) and **User ID** (Identifiers): App Functionality, linked to the user,
   not used for tracking. Add **Name** (Contact Info, linked) only if you keep
   the name Apple shares on first sign-in (the app does, as `full_name` in the
   user metadata). Say "No" to tracking. **Purchases** does not need declaring:
   the subscription is checked on the device with StoreKit and no purchase
   data reaches the developer or any third party.
9. **Age rating questionnaire**: no objectionable content categories apply. The
   2025 questionnaire asks about AI features; answer that the app contains
   AI-generated feedback shown only to the user. Expected rating 4+.
10. **Category**: Education (secondary: Productivity).
11. **Screenshots**: 6.9-inch iPhone set is required; a 13-inch iPad set is
   required while `ios.supportsTablet` is true. Show the Today tab, the word
   reveal, the recording screen, a result and the Talks list. No splash or
   login screens.
12. **Notes for Review**: paste this, and fill in a demo account you created
    in the Supabase dashboard (Authentication → Users → Add user, with
    "Auto confirm" on). Apple asks for one whenever an app has a login.

    > No account is needed. Tap "Today's talk", agree to the data-sharing notice,
    > allow the microphone, and speak for about a minute. The recording is sent
    > to a third-party AI service for transcription and coaching; the consent
    > screen explains this and Profile → About allows withdrawal. Scoring
    > needs a network connection. Feedback is AI-generated and labelled as such.
    > An account is required; sign in with Apple, Google or email on the first
    > screen. Demo account: EMAIL / PASSWORD. Delete account is under Profile (avatar on the Today tab) → Account.
    > The free plan allows three scored talks a week. Mind to Mouth Plus
    > (auto-renewable, monthly) removes the limit; the paywall is under
    > Profile → Plan → See Plus, with Restore purchases on the same screen.

13. **Test on a real device via TestFlight** before review. Apple emails about a
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

## Known limit: the free plan is enforced on the phone

There is no server, so the weekly counter (`src/plan/usage.ts`) lives in the
phone's keychain and the Plus check is StoreKit's on-device verification
(`confirmOnDeviceIOS`). The keychain survives reinstalling the app, which closes
the obvious loophole, but someone who resets the phone, changes its clock or
runs a jailbroken device can get more free talks. That is an acceptable leak at
this size. Moving the counter to the account, or verifying receipts on a
server, would close it, at the cost of storing usage against the account and
saying so in `PRIVACY.md`.

The subscription belongs to the Apple Account, not the app account: it works
for whoever signs in to the app on that phone, and follows the Apple Account to
a new phone through Restore purchases.

## Known risk: the bundled access key

The service key is compiled into the app from `.env`. Anyone who unpacks the
IPA can read it and spend against the account. Apple does not reject apps for
this, but before a public release either put a small proxy with rate limits in
front of the service or set a hard spending cap on the key.
