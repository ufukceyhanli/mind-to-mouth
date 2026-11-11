# Mind to Mouth

A daily speaking drill for iOS, built with Expo. You get a random word, a few
seconds to think, then you talk for at least two minutes. The recording is
transcribed, scored, and reviewed by an AI coach so you can watch yourself get
better at thinking out loud.

Everything runs on free models from [build.nvidia.com](https://build.nvidia.com).
One API key. An account is required: the app opens on a welcome carousel and
nothing else is reachable until you sign up or sign in (see *Accounts* below).

## Run it in Expo Go

```bash
npm install
npx expo start
```

Scan the QR code with the Camera app on your iPhone. Everything the app uses
(`expo-audio`, `expo-secure-store`, `expo-router`, …) ships inside Expo Go, so
no development build is needed.

On first launch, open **Settings** (gear icon) and paste your NVIDIA API key
(`nvapi-…`, from *Get API Key* on any model page at build.nvidia.com). It is
stored in the iOS keychain and only ever sent to `integrate.api.nvidia.com`.

## The flow

1. **Word** – a random prompt from ~250 words (objects, ideas, situations, a few oddballs). Recently used words are avoided.
2. **Think** – a countdown (default 10 s). Tap *I'm ready* to skip it, or *Different word* to reroll.
3. **Talk** – the clock counts down from 2:00. *Finish* only unlocks when you reach the target, then counts up. The screen stays awake, the mic level pulses, and you get a haptic tap at the two-minute mark. Recording auto-stops at the cap (default 5 min).
4. **Score** – the audio is transcribed, scored on-device, sent to the coach, then saved.

## How the audio gets to the model

NVIDIA's hosted speech models (Parakeet, Canary, Whisper) are gRPC-only, which
a phone app in Expo Go cannot speak. Instead the app uses an audio-capable chat
model over plain HTTPS:

- The phone records **uncompressed 16 kHz mono WAV**.
- On-device, the talk is **split at quiet moments** into chunks of roughly
  12 seconds (the model accepts up to 30 s of audio per request), so words are
  not cut in half.
- Each chunk is compressed to **IMA ADPCM WAV** (4 bits per sample, about a
  quarter of the size), which every server-side audio decoder understands, and
  sent inline as a `data:audio/wav;base64,…` URL to `/v1/chat/completions`
  with the model `google/gemma-3n-e4b-it`. Three chunks are in flight at a time.
- The transcripts are stitched back together. The longest pause is measured
  directly from the waveform's energy envelope.

Everything in `src/audio.ts` is pure TypeScript with no native dependency.

## Scoring

The on-device rubric is deterministic and explains every point:

| Component | Max | What it measures |
| --- | --- | --- |
| Kept talking | 15 | Reaching the minimum length |
| Pace | 15 | Words per minute, sweet spot 120–160 |
| Rate variation | 10 | How much the speaking rate (words/min while talking, pauses excluded) changes across the talk |
| Volume | 10 | Speaking level on a 0–10 scale (7 is the target most of the time) and how much it varies |
| Fluency | 15 | Filler words per 100 words (um, uh, like, you know, …) |
| Vocabulary range | 10 | Distinct content words relative to length |
| On topic | 15 | How often the prompt word (or a form of it) came up |
| Flow | 10 | Longest silence, measured from the audio |

Then the coach model, `nvidia/nemotron-3-ultra-550b-a55b` (NVIDIA's most
capable open model), reads the transcript and returns JSON with three content
scores (coherence, structure, relevance, each 0–10), two or three strengths,
two or three improvements, and a drill for tomorrow. The final score is
**60 % rubric + 40 % coach**. If the coach call fails, the rubric alone is
shown with the error.

Both model ids can be changed in Settings, so you can swap in any newer
audio-capable or text model from the catalog without a code change.

## Project layout

```
app/                 Expo Router screens
  _layout.tsx        root stack: loads fonts, hosts the tabs and the practice/result screens
  (tabs)/_layout.tsx bottom tab bar: Today, Talks, Settings
  (tabs)/index.tsx   home: streak, today's talk hero card, recent talks
  practice.tsx       word → countdown → recording → processing
  result/[id].tsx    score breakdown, coach notes, transcript
  (tabs)/history.tsx all talks (swipe left or long-press to delete)
  (tabs)/settings.tsx account, API key, model ids, timing options, privacy
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
  audio.ts           WAV parsing, pause analysis, quiet-point chunking, ADPCM encoder
  nvidia.ts          chat-completions client: transcription + coaching
  scoring.ts         rubric and score blending
  storage.ts         AsyncStorage sessions/settings, SecureStore key, streaks
  theme.ts           design tokens: colours, Lato type scale, radii, shadow
  components/        small UI kit (buttons, cards, chips, pill rows, covers)
```

## Development

```bash
npm run typecheck   # tsc --noEmit
npm run lint        # expo lint
npx expo export --platform ios   # prove the bundle builds
```

## Notes and limits

- Inline payloads on the NVIDIA endpoint are capped around 180 KB, which is
  why chunks are kept to about 14 s at most. A 5-minute talk is ~25 requests.
- Speech-to-text models often clean up "um" and "uh" on their own, so the
  fluency score is kinder than a human listener would be. The coach prompt
  knows this and focuses on content.
- The result screen runs a second pass over the same audio chunks with the
  speech-to-text model, asking which words sounded off. Each flagged word
  gets a tip, a "Hear it" button (system voice via expo-speech) and a
  "Hear yours" button that plays that moment of the saved recording. The
  model's picks are suggestions, not phoneme scores. Turn the pass off in
  Settings to halve the audio requests.
- After scoring, the recording is moved into the app's documents folder
  (`recordings/<session id>.wav`) so each talk can be played back from its
  result screen. Deleting a talk from History removes its audio too. The
  transcript and scores live in AsyncStorage on the device.
- Android's recorder cannot write WAV, so on Android the whole AAC file is sent
  in one request; long talks will exceed the inline limit there. iOS is the
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
