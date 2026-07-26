/**
 * Audio playback. Prefers stored MP3 URL; falls back to browser TTS (zh-CN).
 * Never fails silently — returns whether TTS fallback was used.
 */

let cachedVoice: SpeechSynthesisVoice | null = null;

function pickZhVoice(): SpeechSynthesisVoice | null {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return null;
  if (cachedVoice) return cachedVoice;
  const voices = window.speechSynthesis.getVoices();
  const preferred =
    voices.find((v) => v.lang.toLowerCase() === "zh-cn") ??
    voices.find((v) => v.lang.toLowerCase().startsWith("zh"));
  cachedVoice = preferred ?? null;
  return cachedVoice;
}

export interface PlayOptions {
  audioUrl?: string | null;
  text: string;
  rate?: number; // default 0.85
}

export type PlayResult = "audio" | "tts" | "unavailable";

export async function playChinese({ audioUrl, text, rate = 0.85 }: PlayOptions): Promise<PlayResult> {
  if (audioUrl) {
    try {
      const audio = new Audio(audioUrl);
      audio.playbackRate = rate;
      await audio.play();
      return "audio";
    } catch {
      /* fall through to TTS */
    }
  }
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return "unavailable";
  try {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "zh-CN";
    u.rate = rate;
    const voice = pickZhVoice();
    if (voice) u.voice = voice;
    window.speechSynthesis.speak(u);
    return "tts";
  } catch {
    return "unavailable";
  }
}

// Preload voices list on first import (some browsers load async).
if (typeof window !== "undefined" && "speechSynthesis" in window) {
  window.speechSynthesis.onvoiceschanged = () => {
    cachedVoice = null;
    pickZhVoice();
  };
}
