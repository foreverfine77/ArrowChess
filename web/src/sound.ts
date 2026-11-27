import type { BoardEffect } from './renderer';

type Cue = BoardEffect['kind'] | 'control';
type Note = [frequency: number, offset: number, duration: number, volume: number];
const NOTES: Record<Cue, Note[]> = {
  place: [[230, 0, .13, .08], [620, 0, .035, .03]],
  claim: [[320, 0, .13, .08], [810, 0, .04, .025]],
  close: [[430, 0, .07, .07], [260, .06, .16, .07]],
  hint: [[550, 0, .11, .04], [740, .075, .13, .035]],
  invalid: [[170, 0, .07, .045]],
  win: [[390, 0, .19, .065], [490, .105, .2, .055], [660, .21, .32, .055]],
  control: [[460, 0, .065, .04]],
};

const STORAGE_KEY = 'arrow-chess-sound';
let context: AudioContext | undefined;
let output: GainNode | undefined;
let enabled = true;
try { enabled = localStorage.getItem(STORAGE_KEY) !== 'off'; } catch { /* file mode can restrict storage */ }

export function soundEnabled(): boolean {
  return enabled;
}

export function toggleSound(): void {
  enabled = !enabled;
  try { localStorage.setItem(STORAGE_KEY, enabled ? 'on' : 'off'); } catch { /* optional persistence */ }
  if (output) output.gain.value = enabled ? 1 : 0;
  if (enabled) playSound('control');
}

export function playSound(cue: Cue): void {
  if (!enabled) return;
  const Audio = window.AudioContext ?? (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Audio) return;
  try {
    const audio = context ??= new Audio();
    if (!output) {
      output = audio.createGain();
      output.connect(audio.destination);
    }
    if (audio.state !== 'running') void audio.resume().catch(() => {});
    const start = audio.currentTime + .008;
    for (const [frequency, offset, duration, volume] of NOTES[cue]) {
      const oscillator = audio.createOscillator();
      const gain = audio.createGain();
      const at = start + offset;
      oscillator.type = 'triangle';
      oscillator.frequency.setValueAtTime(frequency, at);
      oscillator.frequency.exponentialRampToValueAtTime(frequency * .84, at + duration);
      gain.gain.setValueAtTime(.001, at);
      gain.gain.linearRampToValueAtTime(volume, at + .005);
      gain.gain.exponentialRampToValueAtTime(.001, at + duration);
      oscillator.connect(gain);
      gain.connect(output);
      oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
      oscillator.start(at);
      oscillator.stop(at + duration);
    }
  } catch { /* audio is optional on restricted devices */ }
}
