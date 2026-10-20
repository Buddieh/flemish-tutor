// All data lives in localStorage on this device. Export/import moves it between devices.
const KEYS = { settings: 'ft.settings', deck: 'ft.deck', sessions: 'ft.sessions' };

const DEFAULT_SETTINGS = {
  apiKey: '',
  model: '',
  voiceURI: '',
  rate: 1,
  showText: true,
  autoSend: true,
};

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.warn('Could not save', key, e);
  }
}

export const getSettings = () => ({ ...DEFAULT_SETTINGS, ...read(KEYS.settings, {}) });
export const saveSettings = (patch) => write(KEYS.settings, { ...getSettings(), ...patch });

// Word deck with simple Leitner boxes: box 0 is new, box 5 is well known.
const DAY = 24 * 60 * 60 * 1000;
const INTERVALS = [0, 1, 2, 4, 8, 16].map((d) => d * DAY);
export const LEARNED_BOX = 3;

export const getDeck = () => read(KEYS.deck, []);
const saveDeck = (deck) => write(KEYS.deck, deck);

const norm = (s) => s.toLowerCase().replace(/[’']/g, "'").replace(/[.,!?¿¡"]/g, '').replace(/\s+/g, ' ').trim();

export function addWords(words, sceneId) {
  const deck = getDeck();
  const seen = new Set(deck.map((w) => norm(w.nl)));
  let added = 0;
  for (const w of words) {
    if (!w || !w.nl || !w.en || seen.has(norm(w.nl))) continue;
    seen.add(norm(w.nl));
    deck.push({
      id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random()),
      nl: w.nl.trim(),
      en: w.en.trim(),
      standard: (w.standard || '').trim(),
      scene: sceneId,
      added: Date.now(),
      box: 0,
      due: Date.now(),
    });
    added++;
  }
  saveDeck(deck);
  return added;
}

export function gradeWord(id, knewIt) {
  const deck = getDeck();
  const w = deck.find((x) => x.id === id);
  if (!w) return;
  w.box = knewIt ? Math.min(w.box + 1, INTERVALS.length - 1) : 0;
  w.due = Date.now() + (knewIt ? INTERVALS[w.box] : 5 * 60 * 1000);
  w.lastReviewed = Date.now();
  saveDeck(deck);
}

export function deleteWord(id) {
  saveDeck(getDeck().filter((w) => w.id !== id));
}

export const dueWords = () => getDeck().filter((w) => w.due <= Date.now()).sort((a, b) => a.due - b.due);

export const getSessions = () => read(KEYS.sessions, []);
export function addSession(s) {
  const sessions = getSessions();
  sessions.unshift({ ...s, date: Date.now() });
  write(KEYS.sessions, sessions);
}

export function streakDays() {
  const days = new Set(
    [...getSessions().map((s) => s.date), ...getDeck().map((w) => w.lastReviewed).filter(Boolean)].map((t) =>
      new Date(t).toDateString(),
    ),
  );
  let streak = 0;
  const d = new Date();
  if (!days.has(d.toDateString())) d.setDate(d.getDate() - 1); // today not done yet keeps yesterday's streak
  while (days.has(d.toDateString())) {
    streak++;
    d.setDate(d.getDate() - 1);
  }
  return streak;
}

export function exportData() {
  const { apiKey, ...settings } = getSettings();
  return JSON.stringify({ version: 1, settings, deck: getDeck(), sessions: getSessions() }, null, 2);
}

export function importData(json) {
  const data = JSON.parse(json);
  if (!Array.isArray(data.deck) || !Array.isArray(data.sessions)) throw new Error('Not a Flemish Tutor backup');
  saveDeck(data.deck);
  write(KEYS.sessions, data.sessions);
  if (data.settings) saveSettings(data.settings);
}

export { norm };
