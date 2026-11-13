import { KIDS, PLACES, computeStats, suggest, sortEvents, todayStr, hostInWeek } from './logic.js';
import { createStore } from './store.js';

const $ = (sel) => document.querySelector(sel);
const WHO_KEY = 'dishes.me.v1';

const state = {
  events: [],
  me: localStorage.getItem(WHO_KEY) || '',
  absent: { mom: new Set(), dad: new Set() },
  date: { mom: todayStr(), dad: todayStr() },
  override: { mom: false, dad: false },
  mode: 'local',
  error: false,
};

let store;

// ---------- עזרים ----------
const kidIdx = (k) => KIDS.indexOf(k);
const avatar = (k, big = false) =>
  `<span class="avatar k${kidIdx(k)} ${big ? 'big' : ''}">${k[0]}</span>`;

function dayLabel(dateStr) {
  if (dateStr === todayStr()) return 'היום';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('he-IL', { weekday: 'short', day: 'numeric', month: 'numeric' });
}

let toastTimer;
function toast(text, undo) {
  const el = $('#toast');
  el.hidden = false;
  el.innerHTML = `<span>${text}</span>${undo ? '<button id="undoBtn">בטל</button>' : ''}`;
  if (undo) $('#undoBtn').onclick = () => { undo(); el.hidden = true; };
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (el.hidden = true), 6000);
}

// ---------- רינדור ----------
function render() {
  renderStatus();
  renderWho();
  renderTurns();
  renderHost();
  renderStats();
  renderHistory();
}

function renderStatus() {
  const banner = $('#banner');
  const status = $('#status');
  if (state.error) {
    banner.hidden = false;
    banner.className = 'banner warn';
    banner.textContent = 'אין חיבור לשרת. מה שתרשמו יישמר ויסונכרן כשהחיבור יחזור.';
  } else if (state.mode === 'local') {
    banner.hidden = false;
    banner.className = 'banner';
    banner.textContent =
      'מצב הדגמה: הנתונים נשמרים רק בטלפון הזה. כדי שכולם יראו אותו דבר, מחברים Firebase (הוראות ב-README).';
  } else {
    banner.hidden = true;
  }
  status.textContent = state.mode === 'cloud' ? 'מסונכרן בין כולם ✓' : 'מצב הדגמה';
}

function renderWho() {
  $('#whoami').innerHTML = state.me ? `${avatar(state.me)}<span>${state.me}</span>` : 'מי אני?';
}

function renderTurns() {
  $('#turns').innerHTML = ['mom', 'dad']
    .map((place) => {
      const host = hostInWeek(state.events, state.date[place]);
      if (host && !state.override[place]) {
        return `
      <article class="card turn ${place}">
        <header>
          <h2>אצל ${PLACES[place]}</h2>
          <input type="date" value="${state.date[place]}" max="${todayStr()}" data-act="date" data-place="${place}" aria-label="תאריך הארוחה">
        </header>
        <div class="skip">${avatar(host.washer, true)}<p><b>${host.washer}</b> אירחה השבוע, אז אין שטיפה אצל ${PLACES[place]}.<br><span class="muted">זה נחשב לה כשטיפה, ותדולג כשיגיע תורה.</span></p></div>
        <button class="btn ghost" data-act="override" data-place="${place}">בכל זאת לרשום שטיפה</button>
      </article>`;
      }
      const absent = [...state.absent[place]];
      const s = suggest(state.events, place, absent);
      const others = s.ranking.slice(1);
      const mine = s.kid && s.kid === state.me;

      const chips = KIDS.map((k) => {
        const on = !state.absent[place].has(k);
        return `<button class="chip ${on ? 'on' : ''}" data-act="toggle" data-place="${place}" data-kid="${k}" aria-pressed="${on}">${on ? '✓' : '✗'} ${k}</button>`;
      }).join('');

      const body = s.kid
        ? `
        <div class="next">
          ${avatar(s.kid, true)}
          <div>
            <span class="label">התור של</span>
            <strong class="name">${s.kid}</strong>
          </div>
          ${mine ? '<span class="badge">זה התור שלך!</span>' : ''}
        </div>
        <p class="muted reason">${s.reason}</p>
        <button class="btn primary" data-act="wash" data-place="${place}" data-kid="${s.kid}">✓ ${s.kid} שטף/ה</button>
        ${
          others.length
            ? `<div class="swap"><span class="muted">שטף/ה במקומו:</span>${others
                .map((k) => `<button class="btn small" data-act="wash" data-place="${place}" data-kid="${k}">${avatar(k)}${k}</button>`)
                .join('')}</div>`
            : ''
        }`
        : '<p class="muted">אף אחד לא סומן כנוכח.</p>';

      return `
      <article class="card turn ${place}">
        <header>
          <h2>אצל ${PLACES[place]}</h2>
          <input type="date" value="${state.date[place]}" max="${todayStr()}" data-act="date" data-place="${place}" aria-label="תאריך הארוחה">
        </header>
        ${body}
        <div class="present"><span class="muted">מי היה בארוחה?</span><div class="chips">${chips}</div></div>
        <button class="btn ghost" data-act="none" data-place="${place}">אין כלים / לא הייתה ארוחה</button>
      </article>`;
    })
    .join('');
}

function renderHost() {
  // כרגע נועה מארחת. אם תרצו שגם אחרים יארחו, אפשר להרחיב כאן.
  $('#hostBtn').textContent = 'נועה אירחה';
}

function renderStats() {
  const stats = computeStats(state.events);
  const max = Math.max(1, ...KIDS.flatMap((k) => [stats[k].mom, stats[k].dad]));
  const nextMom = suggest(state.events, 'mom').kid;
  const nextDad = suggest(state.events, 'dad').kid;

  $('#stats').innerHTML = `
    <div class="legend"><span><i class="dot mom"></i>אמא</span><span><i class="dot dad"></i>אבא</span></div>
    ${KIDS.map((k) => {
      const s = stats[k];
      return `
      <div class="stat-row">
        <div class="stat-name">${avatar(k)}<strong>${k}</strong><span class="muted">סה״כ ${s.total}</span></div>
        <div class="bars">
          <div class="bar-line"><div class="bar mom" style="width:${(s.mom / max) * 100}%"></div><b>${s.mom}</b>${nextMom === k ? '<em>הבא</em>' : ''}</div>
          <div class="bar-line"><div class="bar dad" style="width:${(s.dad / max) * 100}%"></div><b>${s.dad}</b>${nextDad === k ? '<em>הבא</em>' : ''}</div>
        </div>
      </div>`;
    }).join('')}`;
}

function describe(e) {
  if (e.kind === 'host') return `${avatar(e.washer)}<span><b>${e.washer}</b> אירחה · סבב שלם (אמא + אבא)</span>`;
  if (e.kind === 'none') return `<span class="avatar none">–</span><span>אצל ${PLACES[e.place]} · אין כלים / לא הייתה ארוחה</span>`;
  const swapped = e.suggested && e.suggested !== e.washer;
  return `${avatar(e.washer)}<span><b>${e.washer}</b> שטף/ה אצל ${PLACES[e.place]}${swapped ? ` <small class="muted">(במקום ${e.suggested})</small>` : ''}</span>`;
}

function renderHistory() {
  const list = sortEvents(state.events).reverse().slice(0, 40);
  $('#history').innerHTML = list.length
    ? list
        .map(
          (e) => `<li>
            <time>${dayLabel(e.date)}</time>
            <div class="what">${describe(e)}</div>
            <button class="x" data-act="delete" data-id="${e.id}" aria-label="מחיקה">×</button>
          </li>`
        )
        .join('')
    : '<li class="muted empty">עוד לא נרשם כלום. בפעם הבאה שמישהו שוטף, לוחצים על הכפתור הירוק.</li>';
}

// ---------- פעולות ----------
async function log(ev, label) {
  const dup =
    ev.kind !== 'host' &&
    state.events.some((e) => e.kind !== 'host' && e.place === ev.place && e.date === ev.date);
  if (dup && !confirm(`כבר נרשם משהו אצל ${PLACES[ev.place]} בתאריך הזה. לרשום עוד פעם?`)) return;

  const id = await store.add({ ...ev, createdAt: Date.now() });
  if (ev.place) {
    state.absent[ev.place] = new Set();
    state.date[ev.place] = todayStr();
    state.override[ev.place] = false;
  }
  toast(label, () => store.remove(id));
  render();
}

document.addEventListener('click', async (ev) => {
  const t = ev.target.closest('[data-act]');
  if (!t) return;
  const { act, place, kid, id } = t.dataset;

  if (act === 'toggle') {
    const set = state.absent[place];
    set.has(kid) ? set.delete(kid) : set.add(kid);
    if (set.size === KIDS.length) set.delete(kid); // לפחות אחד נוכח
    render();
  } else if (act === 'override') {
    state.override[place] = true;
    render();
  } else if (act === 'wash') {
    const absent = [...state.absent[place]];
    const suggested = suggest(state.events, place, absent).kid;
    await log(
      { kind: 'wash', place, washer: kid, date: state.date[place], absent, suggested },
      `נרשם: ${kid} שטף/ה אצל ${PLACES[place]}`
    );
  } else if (act === 'none') {
    await log(
      { kind: 'none', place, washer: null, date: state.date[place], absent: [], suggested: null },
      `נרשם: אין כלים אצל ${PLACES[place]}`
    );
  } else if (act === 'delete') {
    if (confirm('למחוק את הרישום הזה?')) await store.remove(id);
  }
});

document.addEventListener('change', (ev) => {
  const t = ev.target.closest('[data-act="date"]');
  if (t && t.value) {
    state.date[t.dataset.place] = t.value;
    state.override[t.dataset.place] = false;
    render();
  }
});

$('#hostBtn').addEventListener('click', () =>
  log(
    { kind: 'host', place: null, washer: 'נועה', date: todayStr(), absent: [], suggested: null },
    'נרשם: נועה אירחה (סבב שלם)'
  )
);

// ---------- זהות ----------
function openWho() {
  $('#whoOptions').innerHTML =
    KIDS.map((k) => `<button class="btn who-opt" data-who="${k}">${avatar(k, true)}${k}</button>`).join('') +
    '<button class="btn ghost" data-who="">דילוג</button>';
  $('#whoDialog').showModal();
}
$('#whoami').addEventListener('click', openWho);
$('#whoDialog').addEventListener('click', (ev) => {
  const b = ev.target.closest('[data-who]');
  if (!b) return;
  state.me = b.dataset.who;
  localStorage.setItem(WHO_KEY, state.me);
  localStorage.setItem(WHO_KEY + '.asked', '1');
  $('#whoDialog').close();
  render();
});

// ---------- הפעלה ----------
store = await createStore();
state.mode = store.mode;
store.subscribe(
  (events) => {
    state.events = events;
    state.error = false;
    render();
  },
  () => {
    state.error = true;
    render();
  }
);
render();
if (!state.me && !localStorage.getItem(WHO_KEY + '.asked')) openWho();

if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
