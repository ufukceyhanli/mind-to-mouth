import type { Transcription } from './types';

const ENDPOINT = 'https://api.openai.com/v1/audio/transcriptions';

type WhisperVerboseResponse = {
  text?: string;
  duration?: number;
  segments?: { start: number; end: number; text: string }[];
};

/**
 * Transcribes a local recording with OpenAI Whisper. `verbose_json` gives us
 * segment timestamps, which the rubric uses to measure pauses.
 */
export async function transcribeRecording(params: {
  uri: string;
  apiKey: string;
  topic: string;
}): Promise<Transcription> {
  const { uri, apiKey, topic } = params;

  const form = new FormData();
  // React Native's FormData accepts a file descriptor object for uploads.
  form.append('file', {
    uri,
    name: 'talk.m4a',
    type: 'audio/m4a',
  } as unknown as Blob);
  form.append('model', 'whisper-1');
  form.append('response_format', 'verbose_json');
  form.append('language', 'en');
  form.append('temperature', '0');
  // A short prompt biases recognition toward the topic word's spelling.
  form.append('prompt', `An impromptu two-minute talk about "${topic}".`);

  const response = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    let message = `Transcription failed (${response.status}).`;
    try {
      const parsed = JSON.parse(body) as { error?: { message?: string } };
      if (parsed.error?.message) message = parsed.error.message;
    } catch {
      // keep generic message
    }
    if (response.status === 401) {
      message = 'OpenAI rejected the API key. Check it in Settings.';
    }
    throw new Error(message);
  }

  const data = (await response.json()) as WhisperVerboseResponse;
  return {
    text: (data.text ?? '').trim(),
    segments: (data.segments ?? []).map((s) => ({
      start: s.start,
      end: s.end,
      text: s.text,
    })),
    duration: typeof data.duration === 'number' ? data.duration : null,
  };
}
