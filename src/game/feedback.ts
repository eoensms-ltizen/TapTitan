import type { GameSettings } from "./types";

type FeedbackEvent = "tap" | "crit" | "kill" | "upgrade" | "skill" | "prestige" | "bossRetry" | "save" | "reset";

let audioContext: AudioContext | null = null;

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

function vibrate(pattern: number | number[]): void {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    navigator.vibrate(pattern);
  }
}

export function emitFeedback(event: FeedbackEvent, settings: GameSettings): void {
  if (settings.hapticsEnabled) {
    const patterns: Record<FeedbackEvent, number | number[]> = {
      tap: 8,
      crit: [12, 20, 16],
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
    return;
  }

  switch (event) {
    case "tap":
      playTone(210, 0.055, 0.035, "square");
      playTone(95, 0.045, 0.025, "sine", 0.01);
      break;
    case "crit":
      playTone(360, 0.08, 0.05, "triangle");
      playTone(720, 0.07, 0.035, "triangle", 0.035);
      break;
    case "kill":
      playTone(160, 0.12, 0.05, "sawtooth");
      playTone(520, 0.11, 0.035, "triangle", 0.05);
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
