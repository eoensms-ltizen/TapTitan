import type { GameSettings } from "./types";

type FeedbackEvent =
  | "tap"
  | "heroHit"
  | "crit"
  | "double"
  | "rally"
  | "kill"
  | "upgrade"
  | "skill"
  | "prestige"
  | "bossRetry"
  | "save"
  | "reset";

let audioContext: AudioContext | null = null;
let musicTimer: number | null = null;
let musicStep = 0;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") {
    return null;
  }

  const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextCtor) {
    return null;
  }

  if (!audioContext) {
    audioContext = new AudioContextCtor();
  }

  if (audioContext.state === "suspended") {
    void audioContext.resume();
  }

  return audioContext;
}

function playTone(frequency: number, duration: number, gain: number, type: OscillatorType, delay = 0): void {
  const context = getAudioContext();
  if (!context) {
    return;
  }

  const oscillator = context.createOscillator();
  const gainNode = context.createGain();
  const start = context.currentTime + delay;
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, start);
  gainNode.gain.setValueAtTime(0.0001, start);
  gainNode.gain.exponentialRampToValueAtTime(gain, start + 0.015);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  oscillator.connect(gainNode);
  gainNode.connect(context.destination);
  oscillator.start(start);
  oscillator.stop(start + duration + 0.02);
}

function playNoise(duration: number, gain: number, delay = 0, filterFrequency = 900): void {
  const context = getAudioContext();
  if (!context) {
    return;
  }

  const start = context.currentTime + delay;
  const sampleCount = Math.max(1, Math.floor(context.sampleRate * duration));
  const buffer = context.createBuffer(1, sampleCount, context.sampleRate);
  const data = buffer.getChannelData(0);
  for (let index = 0; index < sampleCount; index += 1) {
    data[index] = (Math.random() * 2 - 1) * (1 - index / sampleCount);
  }

  const source = context.createBufferSource();
  const filter = context.createBiquadFilter();
  const gainNode = context.createGain();
  filter.type = "bandpass";
  filter.frequency.setValueAtTime(filterFrequency, start);
  filter.Q.setValueAtTime(5, start);
  gainNode.gain.setValueAtTime(0.0001, start);
  gainNode.gain.exponentialRampToValueAtTime(gain, start + 0.012);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  source.buffer = buffer;
  source.connect(filter);
  filter.connect(gainNode);
  gainNode.connect(context.destination);
  source.start(start);
  source.stop(start + duration + 0.02);
}

function playMusicPhrase(): void {
  const notes = [110, 146.83, 164.81, 196, 220, 196, 164.81, 146.83];
  const root = notes[musicStep % notes.length];
  musicStep += 1;
  playTone(root, 1.2, 0.006, "sine");
  playTone(root * 2, 0.32, 0.004, "triangle", 0.18);
  playTone(root * 1.5, 0.42, 0.003, "sine", 0.52);
}

export function setMusicEnabled(enabled: boolean): void {
  if (!enabled) {
    if (musicTimer !== null) {
      window.clearInterval(musicTimer);
      musicTimer = null;
    }
    return;
  }

  if (musicTimer !== null) {
    return;
  }

  playMusicPhrase();
  musicTimer = window.setInterval(playMusicPhrase, 1600);
}

function vibrate(pattern: number | number[]): void {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    navigator.vibrate(pattern);
  }
}

export function emitFeedback(event: FeedbackEvent, settings: GameSettings): void {
  if (settings.hapticsEnabled) {
    const patterns: Record<FeedbackEvent, number | number[]> = {
      tap: 8,
      heroHit: 0,
      crit: [12, 20, 16],
      double: [8, 12, 8],
      rally: [8, 14, 10],
      kill: [18, 30, 24],
      upgrade: 14,
      skill: [10, 18, 10],
      prestige: [20, 30, 20, 30, 28],
      bossRetry: [16, 20, 16],
      save: 8,
      reset: [24, 30, 24],
    };
    vibrate(patterns[event]);
  }

  if (!settings.soundEnabled) {
    setMusicEnabled(false);
    return;
  }

  setMusicEnabled(true);

  switch (event) {
    case "tap":
      playTone(210, 0.055, 0.035, "square");
      playTone(95, 0.045, 0.025, "sine", 0.01);
      playNoise(0.045, 0.012, 0, 1300);
      break;
    case "heroHit":
      playTone(150 + Math.random() * 80, 0.045, 0.016, "triangle");
      playNoise(0.04, 0.006, 0, 1600);
      break;
    case "crit":
      playTone(360, 0.08, 0.05, "triangle");
      playTone(720, 0.07, 0.035, "triangle", 0.035);
      playNoise(0.08, 0.018, 0, 2400);
      break;
    case "double":
      playTone(260, 0.045, 0.035, "square");
      playTone(300, 0.045, 0.033, "square", 0.055);
      playNoise(0.06, 0.014, 0.02, 1800);
      break;
    case "rally":
      playTone(240, 0.07, 0.035, "triangle");
      playTone(500, 0.09, 0.03, "triangle", 0.035);
      playTone(760, 0.08, 0.024, "sine", 0.09);
      break;
    case "kill":
      playTone(160, 0.12, 0.05, "sawtooth");
      playTone(520, 0.11, 0.035, "triangle", 0.05);
      playNoise(0.13, 0.022, 0.015, 600);
      break;
    case "upgrade":
      playTone(420, 0.07, 0.035, "triangle");
      playTone(620, 0.08, 0.032, "triangle", 0.045);
      break;
    case "skill":
      playTone(280, 0.1, 0.04, "sine");
      playTone(840, 0.16, 0.03, "triangle", 0.035);
      break;
    case "prestige":
      playTone(240, 0.12, 0.045, "sine");
      playTone(480, 0.14, 0.04, "triangle", 0.06);
      playTone(960, 0.18, 0.03, "triangle", 0.13);
      break;
    case "bossRetry":
      playTone(180, 0.1, 0.045, "sawtooth");
      playTone(340, 0.08, 0.04, "square", 0.06);
      break;
    case "save":
      playTone(520, 0.08, 0.028, "sine");
      break;
    case "reset":
      playTone(170, 0.18, 0.04, "sawtooth");
      break;
  }
}

declare global {
  interface Window {
    webkitAudioContext?: typeof AudioContext;
  }
}
