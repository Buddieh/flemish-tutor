// Browser speech: recognition (mic -> text) and synthesis (text -> voice).
// Tuned for Chrome on Android: continuous recognition is unreliable there, so each
// tap records one utterance, and long replies are spoken sentence by sentence.
import { getSettings } from './store.js';

const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
export const canListen = !!Recognition;
export const canSpeak = 'speechSynthesis' in window;

let recognizer = null;

// Listen once. Calls onInterim(text) while speaking and resolves with
// { text, confidence } when the person pauses, or null if nothing was heard.
export function listen({ onInterim } = {}) {
  stopSpeaking();
  stopListening();
  return new Promise((resolve, reject) => {
    if (!Recognition) return reject(new Error('Speech recognition is not supported in this browser. Use Chrome.'));
    const r = new Recognition();
    recognizer = r;
    r.lang = 'nl-BE';
    r.continuous = false;
    r.interimResults = true;
    r.maxAlternatives = 1;
    let finalText = '';
    let confidence = 1;
    let interim = '';
    r.onresult = (e) => {
      interim = '';
      // Android Chrome can resend earlier results; rebuild from the full list each time.
      let fin = '';
      for (let i = 0; i < e.results.length; i++) {
        const res = e.results[i];
        if (res.isFinal) {
          fin += res[0].transcript;
          confidence = Math.min(confidence, res[0].confidence || 1);
        } else {
          interim += res[0].transcript;
        }
      }
      finalText = fin;
      onInterim?.((finalText + ' ' + interim).trim());
    };
    r.onerror = (e) => {
      recognizer = null;
      if (e.error === 'no-speech' || e.error === 'aborted') return resolve(null);
      if (e.error === 'not-allowed') return reject(new Error('Microphone access was blocked. Allow it in Chrome site settings.'));
      reject(new Error('Speech recognition error: ' + e.error));
    };
    r.onend = () => {
      recognizer = null;
      const text = (finalText || interim).trim();
      resolve(text ? { text, confidence: finalText ? confidence : 0.5 } : null);
    };
    r.start();
  });
}

export function stopListening() {
  if (recognizer) {
    try {
      recognizer.stop();
    } catch {}
  }
}

// Voices load asynchronously on Android.
let voicesReady;
export function getVoices() {
  if (!canSpeak) return Promise.resolve([]);
  if (!voicesReady) {
    voicesReady = new Promise((resolve) => {
      const done = () => resolve(speechSynthesis.getVoices());
      const v = speechSynthesis.getVoices();
      if (v.length) return resolve(v);
      speechSynthesis.addEventListener('voiceschanged', done, { once: true });
      setTimeout(done, 2000);
    });
  }
  return voicesReady.then((all) =>
    all.filter((v) => /^nl([-_]|$)/i.test(v.lang)).sort((a, b) => rank(a) - rank(b)),
  );
}

const rank = (v) => (/be/i.test(v.lang) ? 0 : 1);

async function pickVoice() {
  const voices = await getVoices();
  const { voiceURI } = getSettings();
  return voices.find((v) => v.voiceURI === voiceURI) || voices[0] || null;
}

let generation = 0;

export async function speak(text, { rate } = {}) {
  if (!canSpeak || !text) return;
  stopSpeaking();
  const mine = generation;
  const voice = await pickVoice();
  const r = rate ?? getSettings().rate;
  const parts = text.match(/[^.!?]+[.!?]*/g) || [text];
  for (const part of parts) {
    if (mine !== generation) return;
    await new Promise((resolve) => {
      const u = new SpeechSynthesisUtterance(part.trim());
      u.lang = voice?.lang?.replace('_', '-') || 'nl-BE';
      if (voice) u.voice = voice;
      u.rate = r;
      // Android sometimes never fires onend; don't hang the conversation on it.
      const timer = setTimeout(resolve, 2000 + (part.length * 120) / r);
      u.onend = u.onerror = () => {
        clearTimeout(timer);
        resolve();
      };
      speechSynthesis.speak(u);
    });
  }
}

export function stopSpeaking() {
  generation++;
  if (canSpeak) speechSynthesis.cancel();
}
