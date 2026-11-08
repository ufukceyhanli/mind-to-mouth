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
| 1.2 / 4.7 AI content | Report mechanism and published contact | "Report a problem" link under the coach card and in Settings → About (GitHub issues); the coach prompt forbids remarks about the person |
| 5.1.1(ii) Purpose strings | Explain the microphone use | `NSMicrophoneUsageDescription` in `app.json` says what is recorded and that it is only sent after agreement |
| Privacy manifest | Declare collected data and required-reason APIs | `ios.privacyManifests` in `app.json`: Audio Data, app functionality, not linked, not tracking |
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
3. **Privacy policy URL**: `https://github.com/ufukceyhanli/mind-to-mouth/blob/main/PRIVACY.md`
   (the repo must stay public, or move the page to a site you control and update
   `src/links.ts`).
4. **Support URL**: `https://github.com/ufukceyhanli/mind-to-mouth/issues`.
5. **App Privacy (nutrition label)**: answer "Yes, we collect data". Add
   **Audio Data** under User Content: used for App Functionality, not linked to
   the user's identity, not used for tracking. Nothing else is collected. Say
   "No" to tracking.
6. **Age rating questionnaire**: no objectionable content categories apply. The
   2025 questionnaire asks about AI features; answer that the app contains
   AI-generated feedback shown only to the user. Expected rating 4+.
7. **Category**: Education (secondary: Productivity).
8. **Screenshots**: 6.9-inch iPhone set is required; a 13-inch iPad set is
   required while `ios.supportsTablet` is true. Show the Today tab, the word
   reveal, the recording screen, a result and the Talks list. No splash or
   login screens.
9. **Notes for Review**: paste this.

   > No account or login. Tap "Today's talk", agree to the data-sharing notice,
   > allow the microphone, and speak for about a minute. The recording is sent
   > to NVIDIA's AI model service for transcription and coaching; the consent
   > screen and Settings → Privacy explain this and allow withdrawal. Scoring
   > needs a network connection. Feedback is AI-generated and labelled as such.
   > No in-app purchases.

10. **Test on a real device via TestFlight** before review. Apple emails about a
    missing privacy-manifest reason within minutes of upload; add any reported
    code under `ios.privacyManifests` and upload again.

## Known risk: the bundled access key

The service key is compiled into the app from `.env`. Anyone who unpacks the
IPA can read it and spend against the account. Apple does not reject apps for
this, but before a public release either put a small proxy with rate limits in
front of the service or set a hard spending cap on the key.
