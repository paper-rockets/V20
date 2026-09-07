/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Synthetic haptic audio synthesizer for physical toy feedback
let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

let globalSoundEnabled: boolean = false;

export const setGlobalSoundEnabled = (_enabled: boolean) => {
  globalSoundEnabled = false;
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem('mody_sound_enabled', 'false');
    } catch (_) {}
  }
};

export const getGlobalSoundEnabled = (): boolean => {
  return false;
};

export const playHapticSound = (
  _type?: 'click' | 'pop' | 'snap' | 'squish' | 'tick' | 'whoosh' | 'mode',
  _enabled = false
) => {
  // All auditory feedback removed per user requirement
  return;
};
