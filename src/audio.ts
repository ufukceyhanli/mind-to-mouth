/**
 * On-device audio utilities. Everything here is pure TypeScript and can be
 * unit tested in Node:
 *
 *  - parse the WAV file the recorder writes into 16-bit PCM
 *  - measure pauses, speaking time and loudness from the energy envelope
 *  - cut the talk into fixed windows for pace-over-time
 */

export type PcmAudio = {
  sampleRate: number;
  samples: Int16Array;
};

// ---- WAV parsing ------------------------------------------------------------

function readTag(bytes: Uint8Array, offset: number): string {
  return String.fromCharCode(bytes[offset], bytes[offset + 1], bytes[offset + 2], bytes[offset + 3]);
}

export function isWav(bytes: Uint8Array): boolean {
  return bytes.length >= 12 && readTag(bytes, 0) === 'RIFF' && readTag(bytes, 8) === 'WAVE';
}

/**
 * Parses a RIFF/WAVE file containing integer PCM (8/16/24/32-bit) or 32-bit
 * float and returns mono 16-bit samples. Multi-channel input is averaged.
 * Tolerates the extra chunks CoreAudio writes (e.g. `FLLR`) and a bogus
 * `data` size, both of which show up in real recordings.
 */
export function parseWav(bytes: Uint8Array): PcmAudio {
  if (!isWav(bytes)) throw new Error('Not a WAV file.');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

  let formatTag = 0;
  let channels = 0;
  let sampleRate = 0;
  let bitsPerSample = 0;
  let dataStart = -1;
  let dataLength = 0;

  let offset = 12;
  while (offset + 8 <= bytes.length) {
    const id = readTag(bytes, offset);
    let size = view.getUint32(offset + 4, true);
    const body = offset + 8;
    if (id === 'fmt ') {
      formatTag = view.getUint16(body, true);
      channels = view.getUint16(body + 2, true);
      sampleRate = view.getUint32(body + 4, true);
      bitsPerSample = view.getUint16(body + 14, true);
      if (formatTag === 0xfffe && size >= 26) {
        // WAVE_FORMAT_EXTENSIBLE: the real format lives in the sub-format GUID.
        formatTag = view.getUint16(body + 24, true);
      }
    } else if (id === 'data') {
      dataStart = body;
      const remaining = bytes.length - body;
      if (size === 0 || size === 0xffffffff || size > remaining) size = remaining;
      dataLength = size;
      break;
    }
    offset = body + size + (size % 2);
  }

  if (dataStart < 0 || channels === 0 || sampleRate === 0) {
    throw new Error('WAV file is missing its format or data chunk.');
  }
  if (formatTag !== 1 && formatTag !== 3) {
    throw new Error(`Unsupported WAV encoding (format tag ${formatTag}).`);
  }

  const bytesPerSample = bitsPerSample / 8;
  const frameSize = bytesPerSample * channels;
  const frames = Math.floor(dataLength / frameSize);
  const samples = new Int16Array(frames);

  for (let i = 0; i < frames; i += 1) {
    let acc = 0;
    for (let c = 0; c < channels; c += 1) {
      const p = dataStart + i * frameSize + c * bytesPerSample;
      let v: number;
      if (formatTag === 3) {
        v = Math.max(-1, Math.min(1, view.getFloat32(p, true))) * 32767;
      } else if (bitsPerSample === 16) {
        v = view.getInt16(p, true);
      } else if (bitsPerSample === 8) {
        v = (bytes[p] - 128) << 8;
      } else if (bitsPerSample === 24) {
        v = ((bytes[p] | (bytes[p + 1] << 8) | (bytes[p + 2] << 16)) << 8) >> 16;
      } else if (bitsPerSample === 32) {
        v = view.getInt32(p, true) >> 16;
      } else {
        throw new Error(`Unsupported WAV bit depth (${bitsPerSample}).`);
      }
      acc += v;
    }
    samples[i] = Math.round(acc / channels);
  }

  return { sampleRate, samples };
}

// ---- Energy analysis --------------------------------------------------------

function frameRms(pcm: PcmAudio, frameMs: number): Float32Array {
  const frameLen = Math.max(1, Math.round((pcm.sampleRate * frameMs) / 1000));
  const count = Math.floor(pcm.samples.length / frameLen);
  const out = new Float32Array(count);
  for (let f = 0; f < count; f += 1) {
    let sum = 0;
    const base = f * frameLen;
    for (let i = 0; i < frameLen; i += 1) {
      const s = pcm.samples[base + i] / 32768;
      sum += s * s;
    }
    out[f] = Math.sqrt(sum / frameLen);
  }
  return out;
}

function percentile(values: Float32Array, p: number): number {
  if (values.length === 0) return 0;
  const sorted = Array.from(values).sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.floor(p * (sorted.length - 1))));
  return sorted[idx];
}

/** Adaptive silence threshold between the noise floor and typical speech level. */
function silenceThreshold(rms: Float32Array): number {
  const floor = percentile(rms, 0.15);
  const loud = percentile(rms, 0.9);
  return floor + 0.2 * (loud - floor);
}

export type PauseStats = {
  longestPauseSec: number;
  /** Fraction of frames that are above the silence threshold. */
  speechRatio: number;
  durationSec: number;
};

export function analyzePauses(pcm: PcmAudio, frameMs = 50): PauseStats {
  const rms = frameRms(pcm, frameMs);
  const durationSec = pcm.samples.length / pcm.sampleRate;
  if (rms.length === 0) return { longestPauseSec: 0, speechRatio: 0, durationSec };
  const threshold = silenceThreshold(rms);
  let longest = 0;
  let run = 0;
  let speechFrames = 0;
  for (let i = 0; i < rms.length; i += 1) {
    if (rms[i] < threshold) {
      run += 1;
      if (run > longest) longest = run;
    } else {
      run = 0;
      speechFrames += 1;
    }
  }
  return {
    longestPauseSec: Math.round(((longest * frameMs) / 1000) * 10) / 10,
    speechRatio: speechFrames / rms.length,
    durationSec,
  };
}

// ---- Volume -----------------------------------------------------------------

/**
 * Loudness is reported on a 0–10 scale that coaches use: 0 is barely audible
 * (-50 dBFS), 10 is shouting into the phone (-10 dBFS), and a well-projected
 * speaking voice sits around 7. Four decibels per step.
 */
const LEVEL_FLOOR_DBFS = -50;
const LEVEL_DB_PER_STEP = 4;

export function dbfsToLevel(db: number): number {
  return Math.max(0, Math.min(10, (db - LEVEL_FLOOR_DBFS) / LEVEL_DB_PER_STEP));
}

export type VolumeStats = {
  /** Level most of the talk was spoken at: the median of the speaking windows. */
  typicalLevel: number;
  /** Quietest and loudest stretches (10th and 90th percentile of windows). */
  lowLevel: number;
  highLevel: number;
  /** Median loudness of speech in dBFS, for reference. */
  typicalDbfs: number;
  /** Number of windows that contained enough speech to measure. */
  windows: number;
};

/**
 * Measures how loudly the speaker talked over time. The talk is cut into
 * short windows; each window with enough speech in it gets the median
 * loudness of its speech frames, so pauses do not read as "quiet". Returns
 * null when there is too little speech to say anything.
 */
export function measureVolume(pcm: PcmAudio, frameMs = 50, windowSec = 2): VolumeStats | null {
  const rms = frameRms(pcm, frameMs);
  if (rms.length === 0) return null;
  const threshold = silenceThreshold(rms);
  const framesPerWindow = Math.max(1, Math.round((windowSec * 1000) / frameMs));
  const toDb = (x: number) => 20 * Math.log10(Math.max(x, 1e-6));
  const median = (xs: number[]) => {
    const sorted = [...xs].sort((a, b) => a - b);
    return sorted[Math.floor((sorted.length - 1) / 2)];
  };

  const windowDb: number[] = [];
  for (let start = 0; start < rms.length; start += framesPerWindow) {
    const speech: number[] = [];
    const end = Math.min(rms.length, start + framesPerWindow);
    for (let i = start; i < end; i += 1) if (rms[i] >= threshold) speech.push(toDb(rms[i]));
    // Windows that are mostly silence say nothing about speaking volume.
    if (speech.length >= (end - start) * 0.3) windowDb.push(median(speech));
  }
  if (windowDb.length < 5) return null;

  const sorted = [...windowDb].sort((a, b) => a - b);
  const at = (p: number) => sorted[Math.min(sorted.length - 1, Math.floor(p * (sorted.length - 1)))];
  const typicalDbfs = at(0.5);
  return {
    typicalLevel: Math.round(dbfsToLevel(typicalDbfs) * 10) / 10,
    lowLevel: Math.round(dbfsToLevel(at(0.1)) * 10) / 10,
    highLevel: Math.round(dbfsToLevel(at(0.9)) * 10) / 10,
    typicalDbfs: Math.round(typicalDbfs * 10) / 10,
    windows: windowDb.length,
  };
}

/** Quiet gaps shorter than this are part of speech (between words), not pauses. */
const MIN_PAUSE_MS = 400;

/**
 * Marks each frame as speech or pause. A frame above the silence threshold is
 * speech; so is any quiet frame inside a gap shorter than `MIN_PAUSE_MS`, so
 * soft consonants, word endings and the breath between two words count as
 * talking time. Only genuine pauses are left out.
 */
export function speechMask(rms: Float32Array, threshold: number, frameMs: number): Uint8Array {
  const mask = new Uint8Array(rms.length);
  const minPauseFrames = Math.max(1, Math.round(MIN_PAUSE_MS / frameMs));
  let lastSpeech = -1;
  for (let i = 0; i < rms.length; i += 1) {
    if (rms[i] < threshold) continue;
    mask[i] = 1;
    // Bridge a short quiet gap back to the previous speech frame.
    if (lastSpeech >= 0 && i - lastSpeech - 1 < minPauseFrames) mask.fill(1, lastSpeech + 1, i);
    lastSpeech = i;
  }
  return mask;
}

/**
 * Seconds of speaking time in each chunk, judged against the silence
 * threshold of the whole talk (a per-chunk threshold misjudges short or
 * quiet chunks). Used to measure how fast the speaker talks while talking,
 * leaving pauses out but keeping the natural gaps between words.
 */
export function speechSecondsByChunk(full: PcmAudio, chunks: PcmAudio[], frameMs = 50): number[] {
  const threshold = silenceThreshold(frameRms(full, frameMs));
  return chunks.map((chunk) => {
    const mask = speechMask(frameRms(chunk, frameMs), threshold, frameMs);
    let speechFrames = 0;
    for (let i = 0; i < mask.length; i += 1) speechFrames += mask[i];
    return (speechFrames * frameMs) / 1000;
  });
}

// ---- Windows ----------------------------------------------------------------

/**
 * Cuts the talk into consecutive windows of `windowSec` (the last one may be
 * shorter, and a very short tail is merged into the previous window). Used to
 * measure how the speaking rate changes over the talk.
 */
export function splitIntoWindows(pcm: PcmAudio, windowSec = 15): PcmAudio[] {
  const { sampleRate, samples } = pcm;
  const size = Math.max(1, Math.round(windowSec * sampleRate));
  const minTail = Math.round(3 * sampleRate);
  const windows: PcmAudio[] = [];
  for (let start = 0; start < samples.length; start += size) {
    const end = Math.min(samples.length, start + size);
    if (windows.length > 0 && samples.length - start < minTail) {
      // Fold a short tail into the previous window.
      const prev = windows[windows.length - 1];
      windows[windows.length - 1] = { sampleRate, samples: samples.slice(start - prev.samples.length, end) };
      break;
    }
    windows.push({ sampleRate, samples: samples.slice(start, end) });
  }
  return windows;
}
