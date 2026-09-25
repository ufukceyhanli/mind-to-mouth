/**
 * On-device audio utilities. Everything here is pure TypeScript so it runs
 * in Expo Go and can be unit tested in Node:
 *
 *  - parse the WAV file the recorder writes into 16-bit PCM
 *  - measure pauses from the energy envelope
 *  - split a long talk into short chunks at quiet moments
 *  - encode a chunk as IMA ADPCM WAV (4 bits/sample, ~8 KB/s at 16 kHz)
 *  - base64-encode bytes for inline upload
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

// ---- Chunking ---------------------------------------------------------------

/**
 * Splits audio into chunks of roughly `targetSec`, cutting at the quietest
 * moment within ±`toleranceSec` of each target so words are not sliced in
 * half. A short tail is merged into the previous chunk.
 */
export function splitAtQuietPoints(
  pcm: PcmAudio,
  targetSec = 12,
  toleranceSec = 2,
  frameMs = 50,
): PcmAudio[] {
  const { sampleRate, samples } = pcm;
  const total = samples.length;
  const target = Math.round(targetSec * sampleRate);
  const tol = Math.round(toleranceSec * sampleRate);
  const minTail = Math.round(3 * sampleRate);

  if (total <= target + tol) return [pcm];

  const rms = frameRms(pcm, frameMs);
  const frameLen = Math.round((sampleRate * frameMs) / 1000);
  // Smooth over ~300 ms so a single quiet frame inside a word does not win.
  const smoothRadius = Math.max(1, Math.round(150 / frameMs));
  const smooth = new Float32Array(rms.length);
  for (let i = 0; i < rms.length; i += 1) {
    let sum = 0;
    let n = 0;
    for (let k = -smoothRadius; k <= smoothRadius; k += 1) {
      const j = i + k;
      if (j >= 0 && j < rms.length) {
        sum += rms[j];
        n += 1;
      }
    }
    smooth[i] = sum / n;
  }

  const chunks: PcmAudio[] = [];
  let start = 0;
  while (total - start > target + tol) {
    const lo = Math.floor((start + target - tol) / frameLen);
    const hi = Math.min(smooth.length - 1, Math.floor((start + target + tol) / frameLen));
    let bestFrame = lo;
    for (let f = lo; f <= hi; f += 1) {
      if (smooth[f] < smooth[bestFrame]) bestFrame = f;
    }
    const cut = bestFrame * frameLen;
    if (total - cut < minTail) break;
    chunks.push({ sampleRate, samples: samples.slice(start, cut) });
    start = cut;
  }
  chunks.push({ sampleRate, samples: samples.slice(start) });
  return chunks;
}

// ---- IMA ADPCM WAV encoder --------------------------------------------------

const STEP_TABLE = [
  7, 8, 9, 10, 11, 12, 13, 14, 16, 17, 19, 21, 23, 25, 28, 31, 34, 37, 41, 45, 50, 55, 60, 66,
  73, 80, 88, 97, 107, 118, 130, 143, 157, 173, 190, 209, 230, 253, 279, 307, 337, 371, 408,
  449, 494, 544, 598, 658, 724, 796, 876, 963, 1060, 1166, 1282, 1411, 1552, 1707, 1878, 2066,
  2272, 2499, 2749, 3024, 3327, 3660, 4026, 4428, 4871, 5358, 5894, 6484, 7132, 7845, 8630,
  9493, 10442, 11487, 12635, 13899, 15289, 16818, 18500, 20350, 22385, 24623, 27086, 29794,
  32767,
];
const INDEX_TABLE = [-1, -1, -1, -1, 2, 4, 6, 8, -1, -1, -1, -1, 2, 4, 6, 8];

function writeTag(out: Uint8Array, offset: number, tag: string) {
  for (let i = 0; i < 4; i += 1) out[offset + i] = tag.charCodeAt(i);
}

/**
 * Encodes mono 16-bit PCM as a WAV file with IMA ADPCM (format tag 0x11),
 * the layout libsndfile, ffmpeg and every major decoder understand. Output is
 * roughly a quarter of the PCM size.
 */
export function encodeImaAdpcmWav(pcm: PcmAudio, blockAlign = 256): Uint8Array {
  const { sampleRate, samples } = pcm;
  const samplesPerBlock = (blockAlign - 4) * 2 + 1;
  const blockCount = Math.max(1, Math.ceil(samples.length / samplesPerBlock));
  const dataSize = blockCount * blockAlign;
  const byteRate = Math.floor((sampleRate * blockAlign) / samplesPerBlock);

  // RIFF(12) + fmt(8+20) + fact(8+4) + data(8+dataSize)
  const out = new Uint8Array(12 + 28 + 12 + 8 + dataSize);
  const view = new DataView(out.buffer);

  writeTag(out, 0, 'RIFF');
  view.setUint32(4, out.length - 8, true);
  writeTag(out, 8, 'WAVE');

  writeTag(out, 12, 'fmt ');
  view.setUint32(16, 20, true);
  view.setUint16(20, 0x11, true); // WAVE_FORMAT_IMA_ADPCM
  view.setUint16(22, 1, true); // channels
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 4, true); // bits per sample
  view.setUint16(36, 2, true); // cbSize
  view.setUint16(38, samplesPerBlock, true);

  writeTag(out, 40, 'fact');
  view.setUint32(44, 4, true);
  view.setUint32(48, samples.length, true);

  writeTag(out, 52, 'data');
  view.setUint32(56, dataSize, true);

  let predictor = 0;
  let index = 0;
  let pos = 60;
  let sampleIdx = 0;
  const lastSample = samples.length > 0 ? samples[samples.length - 1] : 0;
  const nextSample = () => (sampleIdx < samples.length ? samples[sampleIdx++] : lastSample);

  for (let b = 0; b < blockCount; b += 1) {
    predictor = nextSample();
    view.setInt16(pos, predictor, true);
    out[pos + 2] = index;
    out[pos + 3] = 0;
    pos += 4;

    for (let i = 0; i < blockAlign - 4; i += 1) {
      let byte = 0;
      for (let nib = 0; nib < 2; nib += 1) {
        const sample = nextSample();
        let diff = sample - predictor;
        const sign = diff < 0 ? 8 : 0;
        if (diff < 0) diff = -diff;

        let step = STEP_TABLE[index];
        let delta = 0;
        let vpdiff = step >> 3;
        if (diff >= step) {
          delta |= 4;
          diff -= step;
          vpdiff += step;
        }
        step >>= 1;
        if (diff >= step) {
          delta |= 2;
          diff -= step;
          vpdiff += step;
        }
        step >>= 1;
        if (diff >= step) {
          delta |= 1;
          vpdiff += step;
        }

        predictor += sign ? -vpdiff : vpdiff;
        if (predictor > 32767) predictor = 32767;
        else if (predictor < -32768) predictor = -32768;

        index += INDEX_TABLE[delta];
        if (index < 0) index = 0;
        else if (index > 88) index = 88;

        const code = sign | delta;
        byte |= nib === 0 ? code : code << 4;
      }
      out[pos++] = byte;
    }
  }

  return out;
}

// ---- Base64 -----------------------------------------------------------------

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

export function bytesToBase64(bytes: Uint8Array): string {
  const parts: string[] = [];
  let i = 0;
  for (; i + 2 < bytes.length; i += 3) {
    const n = (bytes[i] << 16) | (bytes[i + 1] << 8) | bytes[i + 2];
    parts.push(B64[n >> 18], B64[(n >> 12) & 63], B64[(n >> 6) & 63], B64[n & 63]);
  }
  if (i < bytes.length) {
    const rem = bytes.length - i;
    const n = (bytes[i] << 16) | (rem === 2 ? bytes[i + 1] << 8 : 0);
    parts.push(B64[n >> 18], B64[(n >> 12) & 63], rem === 2 ? B64[(n >> 6) & 63] : '=', '=');
  }
  return parts.join('');
}
