import { SCENES, sceneById } from './scenes.js';
import * as store from './store.js';
import { listen, stopListening, speak, stopSpeaking, getVoices, canListen } from './speech.js';
import { tutorTurn, openingMessage, learnerMessage, recap, listModels } from './tutor.js';

const view = document.getElementById('view');

const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

function h(html) {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

// ---------- Router ----------
const routes = {
  '': home,
  scene: scenePreview,
  talk,
  deck,
  review,
  progress,
  settings,
};

let cleanup = null;
function route() {
  cleanup?.();
  cleanup = null;
  stopSpeaking();
  stopListening();
  document.body.classList.remove('talking');
  const [name = '', arg] = location.hash.replace(/^#\/?/, '').split('/');
  const tab = { '': 'home', scene: 'home', talk: 'home', deck: 'deck', review: 'deck', progress: 'progress', settings: 'settings' }[name];
  document.querySelectorAll('.tabs a').forEach((a) => a.classList.toggle('active', a.dataset.tab === tab));
  updateStreak();
  view.innerHTML = '';
  (routes[name] || home)(arg);
  window.scrollTo(0, 0);
}
window.addEventListener('hashchange', route);

function updateStreak() {
  const n = store.streakDays();
  const el = document.getElementById('streak');
  el.hidden = n === 0;
  el.textContent = `${n} day${n === 1 ? '' : 's'} in a row`;
}

// ---------- Home: scene menu ----------
function home() {
  const s = store.getSettings();
  const counts = {};
  store.getSessions().forEach((x) => (counts[x.scene] = (counts[x.scene] || 0) + 1));
  const due = store.dueWords().length;

  view.append(h(`<div>
    <h1>Waar gaan we naartoe?</h1>
    <p class="sub">Pick a situation and talk your way through it.</p>
  </div>`));

  if (!s.apiKey) {
    view.append(h(`<div class="notice">Add your OpenRouter API key in <a href="#/settings">Settings</a> to start talking.</div>`));
  }
  if (!canListen) {
    view.append(h(`<div class="notice">This browser can't do speech recognition. Open the app in Chrome.</div>`));
  }
  if (due > 0) {
    view.append(h(`<a class="card scene" href="#/review" style="margin-bottom:14px">
      <div><div class="t">Review ${due} word${due === 1 ? '' : 's'}</div><div class="e">A few minutes, out loud</div></div>
      <span class="badge">Due</span></a>`));
  }

  const grid = h(`<div class="grid"></div>`);
  for (const sc of SCENES) {
    grid.append(h(`<a class="card scene" href="#/scene/${sc.id}">
      <div><div class="t">${esc(sc.title)}</div><div class="e">${esc(sc.en)}</div></div>
      ${counts[sc.id] ? `<span class="badge">${counts[sc.id]}× done</span>` : ''}
    </a>`));
  }
  view.append(grid);
}

// ---------- Scene preview ----------
function scenePreview(id) {
  const sc = sceneById(id);
  if (!sc) return home();
  const el = h(`<div>
    <h1>${esc(sc.title)}</h1>
    <p class="sub">${esc(sc.en)}. You'll hear these, so listen to each one first.</p>
    <div class="grid" id="phrases"></div>
    <div style="margin-top:20px" class="grid">
      <a class="btn primary block" href="#/talk/${sc.id}">Start talking</a>
      <a class="btn block" href="#/">Back</a>
    </div>
  </div>`);
  const list = el.querySelector('#phrases');
  for (const p of sc.preview) {
    const row = h(`<div class="card phrase">
      <div><div class="nl">${esc(p.nl)}</div><div class="en">${esc(p.en)}</div></div>
      <button class="icon-btn" aria-label="Play">&#9654;</button>
    </div>`);
    row.querySelector('button').onclick = () => speak(p.nl);
    list.append(row);
  }
  view.append(el);
}

// ---------- Conversation ----------
function talk(id) {
  const sc = sceneById(id);
  if (!sc) return home();
  document.body.classList.add('talking');
  const settings = store.getSettings();
  const history = [];
  const seenWords = [];
  let busy = false;
  let listening = false;
  let pendingText = null;
  let alive = true;
  cleanup = () => (alive = false);

  const el = h(`<div class="talk">
    <div class="talk-head">
      <div><div style="font-weight:700">${esc(sc.title)}</div><div class="small">Tap the mic, speak, pause.</div></div>
      <button class="btn" id="done">Gedaan</button>
    </div>
    <div class="log" id="log"></div>
    <div class="dock">
      <div class="interim" id="interim"></div>
      <div class="pending" id="pending" hidden>
        <button class="btn" id="redo">Opnieuw</button>
        <button class="btn primary" id="send">Verstuur</button>
      </div>
      <button class="mic" id="mic" aria-label="Talk">Praat</button>
    </div>
  </div>`);
  view.append(el);
  const log = el.querySelector('#log');
  const interim = el.querySelector('#interim');
  const mic = el.querySelector('#mic');
  const pending = el.querySelector('#pending');

  const scrollDown = () => (el.querySelector('.dock') || log.lastElementChild)?.scrollIntoView({ block: 'end', behavior: 'smooth' });

  function addThem(turn) {
    const m = h(`<div class="msg them ${settings.showText ? '' : 'hidden-text'}">
      <div class="say">${esc(turn.say)}</div>
      <div class="en">${esc(turn.en)}</div>
      ${turn.new.length ? `<div class="newwords">${turn.new.map((w) => `<div><b>${esc(w.nl)}</b>: ${esc(w.en)}</div>`).join('')}</div>` : ''}
      <div class="tools">
        <button class="chip" data-a="again">Nog eens</button>
        <button class="chip" data-a="slow">Trager</button>
        <button class="chip" data-a="en">Wat betekent dat?</button>
      </div>
    </div>`);
    const nw = m.querySelector('.newwords');
    if (nw) nw.style.display = 'none';
    m.querySelector('.say').onclick = () => m.classList.remove('hidden-text');
    m.querySelector('[data-a=again]').onclick = () => speak(turn.say);
    m.querySelector('[data-a=slow]').onclick = () => speak(turn.say, { rate: 0.75 });
    m.querySelector('[data-a=en]').onclick = () => {
      m.classList.remove('hidden-text');
      m.classList.toggle('show-en');
      if (nw) nw.style.display = m.classList.contains('show-en') ? '' : 'none';
    };
    log.append(m);
    if (turn.fix && turn.fix.better) {
      log.append(h(`<div class="fix">${turn.fix.you ? `You said: <i>${esc(turn.fix.you)}</i><br>` : ''}
        Flemish: <span class="better">${esc(turn.fix.better)}</span>${turn.fix.why ? `<div class="small">${esc(turn.fix.why)}</div>` : ''}</div>`));
    }
    seenWords.push(...turn.new);
    scrollDown();
  }

  function addMe(text) {
    log.append(h(`<div class="msg me">${esc(text)}</div>`));
    scrollDown();
  }

  function addError(msg) {
    log.append(h(`<div class="error">${esc(msg)}</div>`));
    scrollDown();
  }

  async function ask(userContent) {
    busy = true;
    mic.disabled = true;
    const thinking = h(`<div class="thinking">…</div>`);
    log.append(thinking);
    scrollDown();
    try {
      history.push({ role: 'user', content: userContent });
      const { turn, raw } = await tutorTurn(sc, history);
      if (!alive) return;
      history.push({ role: 'assistant', content: raw });
      thinking.remove();
      addThem(turn);
      speak(turn.say);
    } catch (e) {
      history.pop();
      thinking.remove();
      addError(e.message);
    } finally {
      busy = false;
      mic.disabled = false;
    }
  }

  async function send(result) {
    pending.hidden = true;
    interim.textContent = '';
    addMe(result.text);
    await ask(learnerMessage(result.text, result.confidence));
  }

  mic.onclick = async () => {
    if (busy) return;
    if (listening) return stopListening();
    pending.hidden = true;
    listening = true;
    mic.classList.add('on');
    mic.textContent = 'Stop';
    interim.textContent = 'Ik luister…';
    try {
      const result = await listen({ onInterim: (t) => (interim.textContent = t) });
      if (!alive) return;
      if (!result) {
        interim.textContent = 'Niks gehoord. Tap and try again.';
      } else if (store.getSettings().autoSend) {
        await send(result);
      } else {
        pendingText = result;
        interim.textContent = result.text;
        pending.hidden = false;
      }
    } catch (e) {
      interim.textContent = '';
      addError(e.message);
    } finally {
      listening = false;
      mic.classList.remove('on');
      mic.textContent = 'Praat';
    }
  };
  el.querySelector('#send').onclick = () => pendingText && send(pendingText);
  el.querySelector('#redo').onclick = () => mic.click();

  el.querySelector('#done').onclick = async () => {
    if (busy) return;
    stopSpeaking();
    stopListening();
    const learnerTurns = history.filter((m) => m.role === 'user').length - 1;
    if (learnerTurns < 1) return (location.hash = '#/');
    busy = true;
    el.querySelector('.dock').remove();
    el.querySelector('#done').remove();
    const making = h(`<div class="thinking">Making your recap…</div>`);
    log.append(making);
    scrollDown();
    let r = { phrases: [], mistakes: [], next: '' };
    try {
      r = await recap(sc, history);
    } catch (e) {
      addError('Could not make a recap: ' + e.message);
    }
    if (!alive) return;
    making.remove();
    const words = [...sc.preview, ...r.phrases, ...seenWords];
    const added = store.addWords(words, sc.id);
    store.addSession({ scene: sc.id, turns: learnerTurns, newWords: added, mistakes: r.mistakes });
    updateStreak();
    showRecap(r, added);
  };

  function showRecap(r, added) {
    const box = h(`<div class="card" style="margin-top:8px">
      <h2 style="margin-top:0">Goed gedaan!</h2>
      <p class="small">${added} new word${added === 1 ? '' : 's'} added to your deck.</p>
      ${r.phrases.length ? `<h2>Phrases to remember</h2><div id="rp"></div>` : ''}
      ${r.mistakes.length ? `<h2>Work on</h2><ul>${r.mistakes.map((m) => `<li>${esc(m)}</li>`).join('')}</ul>` : ''}
      ${r.next ? `<h2>Next time</h2><p>${esc(r.next)}</p>` : ''}
      <div class="grid" style="margin-top:16px">
        <a class="btn primary block" href="#/review">Review words now</a>
        <a class="btn block" href="#/">Back to scenes</a>
      </div>
    </div>`);
    const rp = box.querySelector('#rp');
    for (const p of r.phrases) {
      const row = h(`<div class="list-item"><div><div style="font-weight:600">${esc(p.nl)}</div>
        <div class="small">${esc(p.en)}${p.standard ? ` · instead of <i>${esc(p.standard)}</i>` : ''}</div></div>
        <button class="icon-btn" aria-label="Play">&#9654;</button></div>`);
      row.querySelector('button').onclick = () => speak(p.nl);
      rp.append(row);
    }
    log.append(box);
    scrollDown();
  }

  if (!settings.apiKey) {
    addError('Add your OpenRouter API key in Settings first.');
    log.append(h(`<a class="btn" href="#/settings">Open Settings</a>`));
    mic.disabled = true;
    return;
  }
  ask(openingMessage(sc));
}

// ---------- Word deck ----------
function deck() {
  const words = store.getDeck().sort((a, b) => b.added - a.added);
  const due = store.dueWords().length;
  const el = h(`<div>
    <h1>Your words</h1>
    <p class="sub">${words.length} words · ${words.filter((w) => w.box >= store.LEARNED_BOX).length} learned</p>
    <a class="btn primary block" href="#/review" ${due ? '' : 'aria-disabled="true"'}>${due ? `Review ${due} due now` : 'Nothing due, practise anyway'}</a>
    <div class="card" style="margin-top:14px" id="list"></div>
  </div>`);
  const list = el.querySelector('#list');
  if (!words.length) list.innerHTML = `<p class="small">Finish a scene and the words you met show up here.</p>`;
  for (const w of words) {
    const row = h(`<div class="list-item">
      <div><div style="font-weight:600">${esc(w.nl)}</div>
      <div class="small">${esc(w.en)}${w.standard ? ` · <i>${esc(w.standard)}</i>` : ''}</div>
      <div class="bar" style="width:80px"><span style="width:${(w.box / 5) * 100}%"></span></div></div>
      <div class="row"><button class="icon-btn" data-a="play" aria-label="Play">&#9654;</button>
      <button class="icon-btn" data-a="del" aria-label="Delete">&times;</button></div>
    </div>`);
    row.querySelector('[data-a=play]').onclick = () => speak(w.nl);
    row.querySelector('[data-a=del]').onclick = () => {
      if (confirm(`Remove "${w.nl}" from your deck?`)) {
        store.deleteWord(w.id);
        row.remove();
      }
    };
    list.append(row);
  }
  view.append(el);
}

// ---------- Review ----------
function similarity(a, b) {
  a = store.norm(a);
  b = store.norm(b);
  if (!a.length && !b.length) return 1;
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return 1 - dp[a.length][b.length] / Math.max(a.length, b.length);
}

function review() {
  let queue = store.dueWords();
  if (!queue.length) {
    // Nothing due: practise the least-known words.
    queue = store.getDeck().sort((a, b) => a.box - b.box).slice(0, 10);
  }
  queue = queue.slice(0, 20);
  let i = 0;
  let correct = 0;
  let alive = true;
  cleanup = () => (alive = false);

  const el = h(`<div><h1>Review</h1><p class="sub" id="count"></p><div id="card"></div></div>`);
  view.append(el);
  const cardEl = el.querySelector('#card');

  function next() {
    el.querySelector('#count').textContent = queue.length ? `${Math.min(i + 1, queue.length)} of ${queue.length}` : '';
    if (!queue.length) {
      cardEl.innerHTML = `<div class="card"><p>No words yet. Finish a scene first.</p><a class="btn" href="#/">Scenes</a></div>`;
      return;
    }
    if (i >= queue.length) {
      cardEl.innerHTML = `<div class="card flash"><div class="prompt">Klaar!</div>
        <p>${correct} of ${queue.length} right.</p><a class="btn primary" href="#/">Back to scenes</a></div>`;
      updateStreak();
      return;
    }
    const w = queue[i];
    const c = h(`<div class="card flash">
      <div class="small">How do you say it in Flemish?</div>
      <div class="prompt">${esc(w.en)}</div>
      <div id="heard" class="small" style="margin-top:12px"></div>
      <div id="answer" hidden>
        <div class="answer">${esc(w.nl)}</div>
        ${w.standard ? `<div class="std">Not: ${esc(w.standard)}</div>` : ''}
      </div>
      <div class="grid" style="margin-top:20px" id="ask">
        <button class="mic" style="margin:0 auto" id="say">Zeg het</button>
        <button class="btn" id="show">Show me</button>
      </div>
      <div class="row" style="justify-content:center;margin-top:16px" id="grade" hidden>
        <button class="btn" id="again">&#9654; Again</button>
        <button class="btn" id="no">Not yet</button>
        <button class="btn primary" id="yes">I knew it</button>
      </div>
    </div>`);
    cardEl.replaceChildren(c);
    const reveal = () => {
      c.querySelector('#answer').hidden = false;
      c.querySelector('#ask').hidden = true;
      c.querySelector('#grade').hidden = false;
      speak(w.nl);
    };
    c.querySelector('#show').onclick = reveal;
    c.querySelector('#again').onclick = () => speak(w.nl);
    c.querySelector('#say').onclick = async (ev) => {
      const btn = ev.currentTarget;
      btn.classList.add('on');
      const heard = c.querySelector('#heard');
      try {
        const r = await listen({ onInterim: (t) => (heard.textContent = t) });
        if (!alive) return;
        if (!r) {
          heard.textContent = 'Niks gehoord. Try again.';
          return;
        }
        const score = similarity(r.text, w.nl);
        heard.innerHTML = `Heard: <i>${esc(r.text)}</i><br>${
          score >= 0.75 ? '<span class="result-good">Goed!</span>' : '<span class="result-bad">Not quite. Listen:</span>'
        }`;
        reveal();
      } catch (e) {
        heard.textContent = e.message;
      } finally {
        btn.classList.remove('on');
      }
    };
    const grade = (ok) => {
      store.gradeWord(w.id, ok);
      if (ok) correct++;
      i++;
      next();
    };
    c.querySelector('#yes').onclick = () => grade(true);
    c.querySelector('#no').onclick = () => grade(false);
  }
  next();
}

// ---------- Progress ----------
function progress() {
  const sessions = store.getSessions();
  const words = store.getDeck();
  const learned = words.filter((w) => w.box >= store.LEARNED_BOX).length;
  const scenesDone = new Set(sessions.map((s) => s.scene)).size;
  const el = h(`<div>
    <h1>Progress</h1>
    <div class="stats">
      <div class="card stat"><div class="n">${store.streakDays()}</div><div class="l">days in a row</div></div>
      <div class="card stat"><div class="n">${sessions.length}</div><div class="l">conversations</div></div>
      <div class="card stat"><div class="n">${learned}<span class="small"> / ${words.length}</span></div><div class="l">words learned</div>
        <div class="bar"><span style="width:${words.length ? (learned / words.length) * 100 : 0}%"></span></div></div>
      <div class="card stat"><div class="n">${scenesDone}<span class="small"> / ${SCENES.length}</span></div><div class="l">scenes tried</div>
        <div class="bar"><span style="width:${(scenesDone / SCENES.length) * 100}%"></span></div></div>
    </div>
    <h2>Recent conversations</h2>
    <div class="card" id="list"></div>
  </div>`);
  const list = el.querySelector('#list');
  if (!sessions.length) list.innerHTML = `<p class="small">Nothing yet. Pick a scene and start talking.</p>`;
  for (const s of sessions.slice(0, 30)) {
    const sc = sceneById(s.scene);
    list.append(h(`<div class="list-item"><div>
      <div style="font-weight:600">${esc(sc?.title || s.scene)}</div>
      <div class="small">${new Date(s.date).toLocaleDateString()} · ${s.turns} turn${s.turns === 1 ? "" : "s"} · ${s.newWords} new words</div>
      ${s.mistakes?.length ? `<div class="small">Work on: ${esc(s.mistakes.join('; '))}</div>` : ''}
    </div></div>`));
  }
  view.append(el);
}

// ---------- Settings ----------
function settings() {
  const s = store.getSettings();
  const el = h(`<div>
    <h1>Settings</h1>
    <label class="field"><span>OpenRouter API key</span>
      <input type="password" id="key" autocomplete="off" placeholder="sk-or-..." value="${esc(s.apiKey)}">
      <div class="small">Saved only on this device. Get one at openrouter.ai/keys and set a credit limit.</div></label>
    <label class="field"><span>Model</span>
      <select id="model"><option value="">Loading models…</option></select>
      <div class="small">Sonnet sounds more natural; Haiku answers faster and costs less.</div></label>
    <label class="field"><span>Voice</span>
      <select id="voice"></select>
      <div class="small" id="voicehint"></div></label>
    <label class="field"><span>Speaking speed: <b id="ratev">${s.rate}</b></span>
      <input type="range" id="rate" min="0.6" max="1.3" step="0.05" value="${s.rate}" style="width:100%"></label>
    <label class="toggle"><input type="checkbox" id="show" ${s.showText ? 'checked' : ''}> Show the tutor's text (turn off to train your ear; tap to reveal)</label>
    <label class="toggle"><input type="checkbox" id="auto" ${s.autoSend ? 'checked' : ''}> Send automatically when I stop talking</label>
    <div class="row" style="margin-top:8px"><button class="btn" id="test">Test voice</button></div>
    <h2>Move your data</h2>
    <p class="small">Progress is saved per device. Export on one device and import on another to move it (your API key is not included).</p>
    <div class="row"><button class="btn" id="export">Export</button><button class="btn" id="import">Import</button>
      <input type="file" id="file" accept="application/json" hidden></div>
    <p class="small" id="msg"></p>
  </div>`);
  view.append(el);
  const $ = (q) => el.querySelector(q);

  $('#key').onchange = (e) => store.saveSettings({ apiKey: e.target.value.trim() });
  $('#rate').oninput = (e) => {
    $('#ratev').textContent = e.target.value;
    store.saveSettings({ rate: Number(e.target.value) });
  };
  $('#show').onchange = (e) => store.saveSettings({ showText: e.target.checked });
  $('#auto').onchange = (e) => store.saveSettings({ autoSend: e.target.checked });
  $('#test').onclick = () => speak('Awel, hoe is ’t? Ge spreekt al goed Vlaams, zenne!');

  listModels().then((models) => {
    const sel = $('#model');
    if (!models.length) {
      sel.innerHTML = `<option value="${esc(s.model)}">${esc(s.model || 'Could not load models')}</option>`;
      return;
    }
    sel.innerHTML =
      `<option value="">Automatic (newest Sonnet)</option>` +
      models.map((m) => `<option value="${esc(m.id)}">${esc(m.name || m.id)}</option>`).join('');
    sel.value = s.model;
    sel.onchange = () => store.saveSettings({ model: sel.value });
  });

  getVoices().then((voices) => {
    const sel = $('#voice');
    sel.innerHTML =
      `<option value="">Automatic</option>` +
      voices.map((v) => `<option value="${esc(v.voiceURI)}">${esc(v.name)} (${esc(v.lang)})</option>`).join('');
    sel.value = s.voiceURI;
    sel.onchange = () => store.saveSettings({ voiceURI: sel.value });
    const hasBE = voices.some((v) => /be/i.test(v.lang));
    $('#voicehint').textContent = !voices.length
      ? 'No Dutch voice found. On Android: Settings → System → Languages → Text-to-speech → Speech Services by Google → install Dutch.'
      : hasBE
        ? 'A Belgian (nl-BE) voice is available and chosen automatically.'
        : 'No Belgian voice on this device, so a Netherlands voice is used. Check Speech Services by Google for a Belgian Dutch voice.';
  });

  $('#export').onclick = () => {
    const blob = new Blob([store.exportData()], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `flemish-tutor-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };
  $('#import').onclick = () => $('#file').click();
  $('#file').onchange = async (e) => {
    const f = e.target.files[0];
    if (!f) return;
    if (!confirm('Importing replaces the words and progress on this device. Continue?')) return;
    try {
      store.importData(await f.text());
      $('#msg').textContent = 'Imported.';
    } catch (err) {
      $('#msg').textContent = 'Import failed: ' + err.message;
    }
  };
}

// ---------- Boot ----------
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
route();
