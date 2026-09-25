# Mind to Mouth

A daily speaking drill for iOS, built with Expo. You get a random word, a few
seconds to think, then you talk for at least two minutes. The recording is
transcribed, scored, and (optionally) reviewed by an AI coach so you can watch
yourself get better at thinking out loud.

## Run it in Expo Go

```bash
npm install
npx expo start
```

Scan the QR code with the Camera app on your iPhone. Everything the app uses
(`expo-audio`, `expo-secure-store`, `expo-router`, …) ships inside Expo Go, so
no development build is needed.

On first launch, open **Settings** (gear icon) and add:

| Key | Needed for | Where it goes |
| --- | --- | --- |
| OpenAI API key | Transcription with Whisper (`whisper-1`) | `https://api.openai.com/v1/audio/transcriptions` |
| Anthropic API key (optional) | Written coaching and content scores from Claude | `https://api.anthropic.com/v1/messages` |

Keys are stored in the iOS keychain via `expo-secure-store` and are only ever
sent to the provider they belong to. There is no backend.

## The flow

1. **Word** – a random prompt from ~250 words (objects, ideas, situations, a few oddballs). Recently used words are avoided.
2. **Think** – a countdown (default 10 s). Tap *I'm ready* to skip it, or *Different word* to reroll.
3. **Talk** – the clock counts down from 2:00. *Finish* only unlocks when you reach the target, then counts up. The screen stays awake, the mic level pulses, and you get a haptic tap at the two-minute mark. Recording auto-stops at the cap (default 5 min).
4. **Score** – the audio is transcribed, scored on-device, sent to the coach if configured, then saved.

## Scoring

The on-device rubric is deterministic and explains every point:

| Component | Max | What it measures |
| --- | --- | --- |
| Kept talking | 20 | Reaching the minimum length |
| Pace | 20 | Words per minute, sweet spot 120–160 |
| Fluency | 20 | Filler words per 100 words (um, uh, like, you know, …) |
| Vocabulary range | 15 | Distinct content words relative to length |
| On topic | 15 | How often the prompt word (or a form of it) came up |
| Flow | 10 | Longest silence, from Whisper segment timestamps |

With an Anthropic key, Claude reads the transcript and returns three content
scores (coherence, structure, relevance, each 0–10), two or three strengths,
two or three improvements, and a drill for tomorrow. The final score is
**60 % rubric + 40 % coach**. Without a key, the rubric is the score.

The coach call uses structured outputs so the response always parses, and the
server-side fallback chain so a policy decline on the primary model still
returns feedback where possible.

## Project layout

```
app/                 Expo Router screens
  _layout.tsx        stack navigator
  index.tsx          home: streak, start button, recent talks
  practice.tsx       word → countdown → recording → processing
  result/[id].tsx    score breakdown, coach notes, transcript
  history.tsx        all talks (long-press to delete)
  settings.tsx       API keys and timing options
src/
  words.ts           prompt bank + picker
  scoring.ts         rubric and score blending
  transcribe.ts      Whisper upload
  coach.ts           Claude structured-output call
  storage.ts         AsyncStorage sessions/settings, SecureStore keys, streaks
  components/        small UI kit
```

## Development

```bash
npm run typecheck   # tsc --noEmit
npm run lint        # expo lint
npx expo export --platform ios   # prove the bundle builds
```

## Notes and limits

- Whisper often cleans up "um" and "uh" on its own, so the fluency score is
  kinder than a human listener would be. The coach prompt knows this and
  focuses on content.
- Recordings are deleted from the cache after scoring. Only the transcript and
  scores are kept, in AsyncStorage on the device.
- Android should work too but has not been the focus.
