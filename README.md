# Mind to Mouth

A daily speaking drill for iOS, built with Expo. You get a random word, a few
seconds to think, then you talk for at least two minutes. The recording is
transcribed, scored, and reviewed by an AI coach so you can watch yourself get
better at thinking out loud.

Serving it costs nothing: speech to text runs on the phone with Apple's
Speech framework, and the coach is a Cloudflare Worker on the Workers AI free
allocation. There is no model key in the app. An account is required: the app
opens on a welcome carousel and nothing else is reachable until you sign up or
sign in (see *Accounts* below).

## Run it

```bash
npm install
cp .env.example .env        # Supabase keys, plus EXPO_PUBLIC_COACH_URL once the Worker is deployed
npx expo run:ios            # development build; Expo Go cannot load expo-speech-recognition
```

Without `EXPO_PUBLIC_COACH_URL` the app still works: talks are transcribed and
scored by the on-device rubric, and the coach card says the build has no
coach. Deploy the Worker in [`worker/`](worker/README.md) to turn coaching on.

## Free plan and Plus

The app is free for three scored talks a week (Monday to Sunday), each up to
three minutes. **Mind to Mouth Plus**, an App Store subscription at USD 4.90 a
month, removes the weekly limit, turns on the pronunciation check and allows
talks up to ten minutes. The numbers live in `src/plan/limits.ts`; change them
there and the app, the paywall and the settings hints follow (the website and
`PRIVACY.md` are worded by hand).

- `src/plan/PlanProvider.tsx` talks to StoreKit through `expo-iap`: loads the
  product, buys, restores, and answers "is Plus active". No server is involved.
- `src/plan/usage.ts` keeps the timestamps of scored talks in the keychain.
- `app/plus.tsx` is the paywall, opened from Today, Profile → Plan, Settings and
  the result screen.
- `expo-iap` is native code, so the app needs a development or release build;
  in Expo Go, on Android and in any build without the module, nobody is held
  to the free limits and the Plan section is hidden.
- `EXPO_PUBLIC_PLUS_UNLOCKED=1` in `.env` unlocks Plus for personal builds.
  The App Store Connect setup is step 5 in `APP_STORE.md`.

## Website

`website/` is the public site (<https://mind-to-mouth.web.app>): a landing
page, the privacy policy and a support page, served by Firebase Hosting. The
privacy page is generated from `PRIVACY.md` by `npm run website:build`, so edit
the Markdown, not the HTML. A GitHub Actions workflow deploys it on every push to
`main` (`.github/workflows/website.yml`); `npm run website:deploy` does the same
from a signed-in machine. The one-time
setup is in `website/README.md`.

## The flow

1. **Word** – a random prompt from ~250 words (objects, ideas, situations, a few oddballs). Recently used words are avoided.
2. **Think** – a countdown (default 10 s). Tap *I'm ready* to skip it, or *Different word* to reroll.
3. **Talk** – the clock counts down from 2:00. *Finish* only unlocks when you reach the target, then counts up. The screen stays awake, the mic level pulses, and you get a haptic tap at the two-minute mark. Recording auto-stops at the cap (default 5 min).
4. **Score** – the audio is transcribed, scored on-device, sent to the coach, then saved.

## How a talk becomes text

- The phone records **uncompressed 16 kHz mono WAV**, the format Apple's
  recognizer reads from a file.
- `src/transcribe.ts` feeds the file to the system recognizer through
  [`expo-speech-recognition`](https://github.com/jamsch/expo-speech-recognition)
  with `requiresOnDeviceRecognition` on, so the audio never leaves the phone and
  there is no per-request length limit. On the rare device without an offline
  English model it falls back to Apple's speech service.
- iOS 18+ finalises each utterance separately; the final results are
  concatenated in order. Each word comes back with its timestamp and a
  confidence, which feed the pace-over-time measure and the pronunciation
  check.
- Pauses, loudness and speaking time per 15-second stretch are measured
  directly from the waveform's energy envelope (`src/audio.ts`, pure
  TypeScript).

## Scoring

The on-device rubric is deterministic and explains every point:

| Component | Max | What it measures |
| --- | --- | --- |
| Pace | 25 | Words per minute, sweet spot 120–160 |
| Rate variation | 15 | How much the speaking rate (words/min while talking, pauses excluded) changes across the talk |
| Volume | 15 | Speaking level on a 0–10 scale (7 is the target most of the time) and how much it varies |
| Fluency | 25 | Filler words per 100 words (um, uh, like, you know, …) |
| Vocabulary range | 20 | Distinct content words relative to length |

Length, staying on topic and pauses are not scored by the rubric. The longest
pause and the number of times the prompt word came up are still measured and
passed to the coach, who judges relevance from the whole transcript.

Then the coach reads the transcript and returns three content scores
(coherence, structure, relevance, each 0–10), two or three strengths, two or
three improvements, and a drill for tomorrow. The final score is
**60 % rubric + 40 % coach**. If the coach call fails, the rubric alone is
shown with the error.

The coach is the Cloudflare Worker in [`worker/`](worker/README.md). It owns
the prompt and the model (Llama 3.3 70B on Workers AI by default), rate-limits
by IP, and optionally checks a shared app token. The app sends only the
transcript and the measured stats.

## Project layout

```
app/                 Expo Router screens
  _layout.tsx        root stack: loads fonts, hosts the tabs and the practice/result screens
  (tabs)/_layout.tsx bottom tab bar: Today, Talks, Settings
  (tabs)/index.tsx   home: streak, today's talk hero card, recent talks
  practice.tsx       word → countdown → recording → processing
  result/[id].tsx    score breakdown, coach notes, transcript
  (tabs)/history.tsx all talks (swipe left or long-press to delete)
  (tabs)/settings.tsx API key, model ids, timing options
  profile.tsx        account (sign out, delete), privacy choices, about; from the avatar on Today
  auth/welcome.tsx   first screen when signed out: what the app does, Get Started, I have an account
  auth/index.tsx     create account, step 1: continue with email, Apple or Google
  auth/sign-up.tsx   create account, step 2: email and password
  auth/sign-in.tsx   sign in: Apple, Google, email + password, email link, forgot password
  auth/reset.tsx     pick a new password after a reset link
  auth/callback.tsx  landing route for email links (mindtomouth://auth/callback)
src/
  auth/supabase.ts   Supabase client, encrypted session storage, link parsing
  auth/AuthProvider.tsx  session state, sign-in methods, account deletion
  words.ts           prompt bank + picker
  audio.ts           WAV parsing, pause, volume and speaking-time analysis
  transcribe.ts      on-device speech recognition (words, timings, confidence)
  coach.ts           client for the coaching Worker
  pronunciation.ts   on-device "worth a listen" pass from word confidences
  scoring.ts         rubric and score blending
  storage.ts         AsyncStorage sessions/settings/consent, streaks
  theme.ts           design tokens: colours, Lato type scale, radii, shadow
  components/        small UI kit (buttons, cards, chips, pill rows, covers)
worker/              Cloudflare Worker: coaching on Workers AI (free allocation)
```

## Development

```bash
npm run typecheck   # tsc --noEmit
npm run lint        # expo lint
npx expo prebuild --platform ios --clean   # regenerate ios/ after plugin changes
(cd worker && npm run typecheck)
```

## Notes and limits

- Apple's recognizer drops most "um" and "uh" on its own, so the fluency score
  is kinder than a human listener would be. The coach prompt knows this and
  focuses on content.
- Workers AI's free allocation covers roughly 70 coaching calls a day on the
  default model; past that the Worker returns 503 and the app shows the rubric
  score with a note. See `worker/README.md` for cheaper models.
- The result screen (Plus) runs the saved recording through the on-device
  recognizer once more and flags the words it was least sure of. Each flagged
  word gets a "Hear it" button (system voice via expo-speech) and a "Hear
  yours" button that plays that moment of the saved recording. Confidence
  reflects how clearly a word came through, not accent, and some devices
  report none at all, in which case the card says so.
- After scoring, the recording is moved into the app's documents folder
  (`recordings/<session id>.wav`) so each talk can be played back from its
  result screen. Deleting a talk from History removes its audio too. The
  transcript and scores live in AsyncStorage on the device.
- Android's recorder cannot write WAV, and Android's file recognition expects
  16 kHz PCM, so transcription from the AAC file is untested there. iOS is the
  focus.

## Accounts

Every user needs an account, but it only identifies them; talks never leave
the phone. The root layout (`app/_layout.tsx`) wraps the tabs, practice and
result screens in a signed-in guard, so a signed-out user can only see the
welcome carousel and the sign-up and sign-in screens, and signing out drops
them straight back there. Accounts run on [Supabase](https://supabase.com)
auth, configured through `.env` with `EXPO_PUBLIC_SUPABASE_URL` and
`EXPO_PUBLIC_SUPABASE_ANON_KEY` (see `.env.example`). A build without them
cannot sign anyone in and says so on the account screens. Metro inlines these values when it transforms `src/auth/supabase.ts`
and caches the result by source content, so after editing `.env` clear the
cache (`rm -rf "$TMPDIR/metro-cache"` or `npx expo start --clear`) before
building, or the app ships the old values. Setup, including the redirect URL, the Apple provider and the
`supabase/schema.sql` function behind *Delete account*, is listed step by step
in `APP_STORE.md`. Sign in with Apple needs a development build (the
`expo-apple-authentication` native module is not in Expo Go). *Continue with
Google* opens Google's consent page in the system browser through Supabase
(`signInWithOAuth` + `expo-web-browser`) and needs the Google provider enabled
in the Supabase dashboard; until it is, the button explains that it is not set
up yet.

## Privacy and App Store

`PRIVACY.md` is the privacy policy the app links to. `APP_STORE.md` lists what the code covers for App Review and the steps that remain in App Store Connect.
