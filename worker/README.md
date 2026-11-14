# Coach worker

A Cloudflare Worker that turns a talk transcript into coaching notes with
[Workers AI](https://developers.cloudflare.com/workers-ai/). It runs inside
the free allocation (10,000 neurons per day, reset at 00:00 UTC) on the
Workers Free plan, so serving the app costs nothing until roughly 70 talks a
day on the default model. The app never holds a model key: it only knows the
Worker's URL and, optionally, a shared token.

## Deploy

```bash
cd worker
npm install
npx wrangler login          # opens the Cloudflare dashboard in your browser
npx wrangler deploy
```

The deploy output prints the Worker URL (`https://mind-to-mouth-coach.<account>.workers.dev`).
Put it in the app's `.env` as `EXPO_PUBLIC_COACH_URL`.

### Optional shared token

Anything baked into an app binary can be extracted, so the token is a speed
bump, not a secret. It still stops drive-by use of the URL:

```bash
npx wrangler secret put APP_TOKEN
```

Set the same value as `EXPO_PUBLIC_COACH_TOKEN` in the app's `.env`.

## Model and cost

`COACH_MODEL` in `wrangler.jsonc` picks the model. Approximate neurons per
talk (1,500 input + 500 output tokens) from the Workers AI price list:

| Model | Neurons / talk | Free talks / day |
| --- | --- | --- |
| `@cf/meta/llama-3.3-70b-instruct-fp8-fast` (default) | ~140 | ~70 |
| `@cf/openai/gpt-oss-120b` | ~80 | ~120 |
| `@cf/qwen/qwen3-30b-a3b-fp8` | ~20 | ~450 |

Above the free allocation Workers AI bills USD 0.011 per 1,000 neurons on
the Workers Paid plan, i.e. about a tenth of a cent per talk.

The Worker asks for JSON-schema output first and falls back to plain text
parsing for models that reject `response_format`.

## Abuse protection

- Per-IP rate limit of 6 requests a minute (Rate Limiting binding).
- Transcripts over 12,000 characters are rejected.
- Optional `APP_TOKEN` header check.

## Endpoints

- `POST /coach` with `{ topic, transcript, durationSec, stats }` returns
  `{ coach: { summary, coherence, structure, relevance, strengths, improvements, nextDrill }, model }`.
- `GET /health` returns `{ ok: true, model }`.

## Local test

```bash
npx wrangler dev
curl -s localhost:8787/coach -H 'content-type: application/json' \
  -d '{"topic":"bridge","durationSec":125,"stats":{"wordCount":280,"wordsPerMinute":134,"fillerCount":4,"topicMentions":3},"transcript":"..."}'
```

`wrangler dev` runs Workers AI remotely, so it uses your account's allocation.
