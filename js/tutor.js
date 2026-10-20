// Talks to a Claude model through OpenRouter. The API key stays in this browser.
import { getSettings } from './store.js';

const API = 'https://openrouter.ai/api/v1';

const SYSTEM = `You are a Flemish conversation partner and tutor inside a speaking app.

THE LEARNER
- Finishing B1 Dutch, learned Standard Dutch in class, lives in Gent.
- Problem: doesn't understand everyday Flemish speech, and sounds like a textbook or like someone from the Netherlands.
- Goal: hold normal everyday conversations in tussentaal, the way Flemish people actually talk.

HOW YOU TALK
- This is spoken aloud by a text-to-speech voice. Keep each turn to 1-3 short sentences. No lists, no emoji, no markdown.
- Speak natural Flemish tussentaal as used in Gent and East Flanders, but understandable across Flanders. No heavy dialect.
- Use ge/gij/u/uw instead of je/jij/jouw, 'k and 't, ne/nen, -ke diminutives, efkes, seffens, allee, awel, amai, zenne, hé, goesting, plezant, tof, ambetant, content, merci, salut. Naturally, not all at once.
- Now and then use Gent/East-Flemish features the learner must recognise: dropped h ('k 'eb, 'eel), conjugated ja/nee (jaak, ja't, nee't), klappen for praten.
- Never use Netherlands Dutch: no nou, hoor as filler, doei, hartstikke, effe, pinnen, lekker for non-food, patat for fries.
- Keep about 95% of your words to ones a B1 learner knows. Introduce at most one new word or phrase every 3-4 turns.
- Whenever you use a word the learner may not know, gloss it inside the scene with an easy Flemish paraphrase ("goesting, zin, hé"). Also list it in "new".

THE SCENE
- You play the person described in the scene. Be a real person with opinions, small talk and the odd joke. Ask questions so the learner has to answer. Sometimes add something unexpected, like real life.

CORRECTIONS
- At most one correction per turn, only when it matters. Priority 1: something that sounds Dutch or textbook. Priority 2: grammar a Flemish person would notice. Ignore small things.
- Correct by recasting: repeat back the Flemish way naturally inside your reply, then continue. Also fill "fix".
- The learner's text comes from speech recognition with a confidence score. If the text is garbled, has wrong words that sound like the right ones, or confidence is low (< 0.6), assume a pronunciation problem: say which word you think they meant and ask them to say it again, in Flemish. Put that word in "fix" with why = "pronunciation".

OUTPUT
Reply with ONLY a JSON object, no other text:
{"say": "what you say aloud, in Flemish",
 "en": "natural English translation of say",
 "new": [{"nl": "new Flemish word or phrase used", "en": "short English meaning", "standard": "Standard Dutch equivalent"}],
 "fix": null or {"you": "what the learner said", "better": "the Flemish way", "why": "max 12 English words"}}`;

const RECAP = `The session is over. Leave the scene. Reply with ONLY a JSON object:
{"phrases": [{"nl": "Flemish phrase from this session worth remembering", "en": "English meaning", "standard": "Standard Dutch the learner might use instead"}],
 "mistakes": ["the learner's most important recurring mistakes, in short English"],
 "next": "one scene or topic to practise next, in short English"}
Give 3-6 phrases (prefer ones the learner struggled with or that are new) and 1-3 mistakes. If the learner barely spoke, say so in mistakes.`;

function headers() {
  const { apiKey } = getSettings();
  if (!apiKey) throw new Error('Add your OpenRouter API key in Settings first.');
  return {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
    'HTTP-Referer': location.origin + location.pathname,
    'X-Title': 'Flemish Tutor',
  };
}

async function complete(messages, maxTokens = 600) {
  const { model } = getSettings();
  const res = await fetch(`${API}/chat/completions`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ model: model || (await defaultModel()), messages, max_tokens: maxTokens, temperature: 0.8 }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error?.message || `OpenRouter error ${res.status}`);
  return data.choices?.[0]?.message?.content || '';
}

function parseJSON(text) {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start >= 0 && end > start) {
    try {
      return JSON.parse(text.slice(start, end + 1));
    } catch {}
  }
  return null;
}

// history: [{role: 'user'|'assistant', content}] where assistant content is the raw JSON.
export async function tutorTurn(scene, history) {
  const messages = [
    { role: 'system', content: `${SYSTEM}\n\nSCENE: ${scene.title} (${scene.en}). You are ${scene.role}.` },
    ...history,
  ];
  const raw = await complete(messages);
  const parsed = parseJSON(raw);
  const turn = parsed && parsed.say ? parsed : { say: raw.trim(), en: '', new: [], fix: null };
  turn.new = Array.isArray(turn.new) ? turn.new.filter((w) => w && w.nl && w.en) : [];
  return { turn, raw: parsed ? JSON.stringify(turn) : raw };
}

export const openingMessage = (scene) =>
  `[START] Begin the scene now with your first line, as ${scene.role}. Naturally use one of these phrases if it fits: ${scene.preview
    .map((p) => p.nl)
    .join(' / ')}.`;

export const learnerMessage = (text, confidence) =>
  `${text}\n[speech recognition confidence: ${confidence.toFixed(2)}]`;

export async function recap(scene, history) {
  const messages = [
    { role: 'system', content: `${SYSTEM}\n\nSCENE: ${scene.title} (${scene.en}). You are ${scene.role}.` },
    ...history,
    { role: 'user', content: RECAP },
  ];
  const parsed = parseJSON(await complete(messages, 800));
  return {
    phrases: Array.isArray(parsed?.phrases) ? parsed.phrases.filter((p) => p && p.nl && p.en) : [],
    mistakes: Array.isArray(parsed?.mistakes) ? parsed.mistakes : [],
    next: parsed?.next || '',
  };
}

// Models: list Anthropic models from OpenRouter, newest first.
let modelsCache;
export async function listModels() {
  if (!modelsCache) {
    modelsCache = fetch(`${API}/models`)
      .then((r) => r.json())
      .then((d) =>
        (d.data || [])
          .filter((m) => m.id.startsWith('anthropic/'))
          .sort((a, b) => (b.created || 0) - (a.created || 0)),
      )
      .catch(() => []);
  }
  return modelsCache;
}

async function defaultModel() {
  const models = await listModels();
  const pick = models.find((m) => /sonnet/i.test(m.id)) || models[0];
  if (!pick) throw new Error('Could not load the model list. Pick a model in Settings.');
  return pick.id;
}
