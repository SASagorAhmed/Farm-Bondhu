/**
 * Generates 12 professional sine notification WAV files for marketplace chat.
 * Run: node scripts/generateChatSounds.mjs
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, "..", "public", "sounds", "chat");

const SAMPLE_RATE = 44100;
const PEAK_GAIN = 0.22;
const ATTACK_SEC = 0.005;

/** @typedef {{ freq: number; start: number; dur: number; gain?: number }} SineNote */

const SOUNDS = [
  { fileName: "classic-ding.wav", notes: [{ freq: 880, start: 0, dur: 0.18 }] },
  {
    fileName: "soft-chime.wav",
    notes: [
      { freq: 660, start: 0, dur: 0.14, gain: 0.85 },
      { freq: 880, start: 0.1, dur: 0.18 },
    ],
  },
  { fileName: "bright-bell.wav", notes: [{ freq: 988, start: 0, dur: 0.16 }] },
  {
    fileName: "double-tap.wav",
    notes: [
      { freq: 784, start: 0, dur: 0.1, gain: 0.8 },
      { freq: 880, start: 0.12, dur: 0.12 },
    ],
  },
  { fileName: "gentle-pop.wav", notes: [{ freq: 740, start: 0, dur: 0.12 }] },
  {
    fileName: "marimba.wav",
    notes: [
      { freq: 523, start: 0, dur: 0.12, gain: 0.75 },
      { freq: 659, start: 0.09, dur: 0.14 },
    ],
  },
  { fileName: "digital-beep.wav", notes: [{ freq: 831, start: 0, dur: 0.11 }] },
  {
    fileName: "bubble.wav",
    notes: [
      { freq: 620, start: 0, dur: 0.1, gain: 0.7 },
      { freq: 740, start: 0.08, dur: 0.14 },
    ],
  },
  { fileName: "wood-block.wav", notes: [{ freq: 698, start: 0, dur: 0.1, gain: 0.65 }] },
  {
    fileName: "alert-tone.wav",
    notes: [
      { freq: 784, start: 0, dur: 0.1, gain: 0.75 },
      { freq: 988, start: 0.11, dur: 0.12 },
    ],
  },
  { fileName: "message-ping.wav", notes: [{ freq: 784, start: 0, dur: 0.14 }] },
  {
    fileName: "farm-bell.wav",
    notes: [
      { freq: 784, start: 0, dur: 0.2, gain: 0.9 },
      { freq: 988, start: 0.06, dur: 0.22, gain: 0.55 },
    ],
  },
];

function renderSound(notes, durationSec = 0.35) {
  const length = Math.ceil(SAMPLE_RATE * durationSec);
  const samples = new Float32Array(length);

  for (const note of notes) {
    const noteGain = note.gain ?? 1;
    const startSample = Math.floor(note.start * SAMPLE_RATE);
    const endSample = Math.min(length, startSample + Math.floor(note.dur * SAMPLE_RATE));
    for (let i = startSample; i < endSample; i++) {
      const t = (i - startSample) / SAMPLE_RATE;
      const phase = 2 * Math.PI * note.freq * t;
      const sample = Math.sin(phase);

      const attack = Math.min(1, t / ATTACK_SEC);
      const release = Math.min(1, (note.dur - t) / 0.06);
      const env = attack * release * PEAK_GAIN * noteGain;
      samples[i] += sample * env;
    }
  }

  for (let i = 0; i < length; i++) {
    samples[i] = Math.max(-1, Math.min(1, samples[i]));
  }
  return samples;
}

function floatTo16BitPCM(float32Array) {
  const buffer = Buffer.alloc(float32Array.length * 2);
  for (let i = 0; i < float32Array.length; i++) {
    const s = Math.max(-1, Math.min(1, float32Array[i]));
    buffer.writeInt16LE(s < 0 ? s * 0x8000 : s * 0x7fff, i * 2);
  }
  return buffer;
}

function encodeWav(samples) {
  const pcm = floatTo16BitPCM(samples);
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(SAMPLE_RATE, 24);
  header.writeUInt32LE(SAMPLE_RATE * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write("data", 36);
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}

mkdirSync(outDir, { recursive: true });

for (const sound of SOUNDS) {
  const samples = renderSound(sound.notes);
  const wav = encodeWav(samples);
  writeFileSync(join(outDir, sound.fileName), wav);
  console.log("Wrote", sound.fileName);
}

console.log("Done —", SOUNDS.length, "files in", outDir);
