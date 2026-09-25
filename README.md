# Mind to Mouth

A daily speaking drill for iOS, built with Expo. You get a random word, a few
seconds to think, then you talk for at least two minutes. The recording is
transcribed, scored, and reviewed by an AI coach so you can watch yourself get
better at thinking out loud.

Everything runs on free models from [build.nvidia.com](https://build.nvidia.com).
One API key, no other accounts.

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
| Kept talking | 20 | Reaching the minimum length |
| Pace | 20 | Words per minute, sweet spot 120–160 |
| Fluency | 20 | Filler words per 100 words (um, uh, like, you know, …) |
| Vocabulary range | 15 | Distinct content words relative to length |
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
  _layout.tsx        stack navigator
  index.tsx          home: streak, start button, recent talks
  practice.tsx       word → countdown → recording → processing
  result/[id].tsx    score breakdown, coach notes, transcript
  history.tsx        all talks (long-press to delete)
  settings.tsx       API key, model ids, timing options
src/
  words.ts           prompt bank + picker
  audio.ts           WAV parsing, pause analysis, quiet-point chunking, ADPCM encoder
  nvidia.ts          chat-completions client: transcription + coaching
  scoring.ts         rubric and score blending
  storage.ts         AsyncStorage sessions/settings, SecureStore key, streaks
  components/        small UI kit
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
- Recordings are deleted from the cache after scoring. Only the transcript and
  scores are kept, in AsyncStorage on the device.
- Android's recorder cannot write WAV, so on Android the whole AAC file is sent
  in one request; long talks will exceed the inline limit there. iOS is the
  focus.
