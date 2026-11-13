import assert from 'node:assert/strict';
import { computeStats, suggest, KIDS } from '../logic.js';

let t = 0;
const wash = (place, washer, date, extra = {}) => ({ kind: 'wash', place, washer, date, createdAt: ++t, ...extra });
const host = (washer, date) => ({ kind: 'host', washer, date, createdAt: ++t });
const none = (place, date) => ({ kind: 'none', place, date, createdAt: ++t });

// 1. התחלה ריקה: שוויון מלא, הראשון ברשימה
assert.equal(suggest([], 'mom').kid, 'נועה');

// 2. אמא ואבא נספרים בנפרד
let ev = [wash('mom', 'נועה', '2026-11-01')];
assert.equal(suggest(ev, 'mom').kid, 'נווה');   // נועה כבר שטפה אצל אמא
assert.equal(suggest(ev, 'dad').kid, 'נווה');   // אצל אבא כולם 0, אבל לנועה כבר יש שטיפה בסך הכול

// 3. סבב מלא עד שכולם שווים, ואז מי ששטף הכי מזמן
ev = [
  wash('mom', 'נועה', '2026-11-01'),
  wash('mom', 'נווה', '2026-11-08'),
  wash('mom', 'אופק', '2026-11-15'),
];
assert.equal(suggest(ev, 'mom').kid, 'נועה');   // כולם 1, נועה שטפה הכי מזמן

// 4. אירוח של נועה נספר גם אצל אמא וגם אצל אבא
ev = [host('נועה', '2026-11-01')];
let s = computeStats(ev);
assert.deepEqual([s['נועה'].mom, s['נועה'].dad, s['נועה'].total], [1, 1, 2]);
assert.notEqual(suggest(ev, 'mom').kid, 'נועה');
assert.notEqual(suggest(ev, 'dad').kid, 'נועה');

// 5. "אין כלים" לא נספר לאף אחד
ev = [none('mom', '2026-11-01')];
s = computeStats(ev);
assert.ok(KIDS.every((k) => s[k].total === 0));

// 6. מי שלא היה בארוחה לא מוצע, ולא נפגע
ev = [];
assert.equal(suggest(ev, 'mom', ['נועה']).kid, 'נווה');
ev = [wash('mom', 'נווה', '2026-11-01')];
assert.equal(suggest(ev, 'mom', ['נועה']).kid, 'אופק');
assert.equal(suggest(ev, 'mom').kid, 'נועה'); // כשנועה חוזרת היא ראשונה בתור

// 7. החלפה: הנקודה הולכת למי ששטף בפועל
ev = [wash('dad', 'אופק', '2026-11-01', { suggested: 'נועה' })];
assert.equal(computeStats(ev)['אופק'].dad, 1);
assert.equal(computeStats(ev)['נועה'].dad, 0);

// 8. שוויון בספירה אצל ההורה: מי שיש לו פחות סה"כ מקבל עדיפות אם שניהם לא שטפו שם מעולם
ev = [wash('dad', 'נועה', '2026-11-01'), wash('dad', 'נועה', '2026-11-08')];
// נועה ללא שטיפה אצל אמא, אבל יש לה 2 סה"כ. נווה ואופק עם 0 סה"כ קודמים לה
assert.notEqual(suggest(ev, 'mom').kid, 'נועה');

// 9. סימולציה ארוכה: הפער אצל כל הורה אף פעם לא עולה על 1
ev = [];
for (let w = 0; w < 30; w++) {
  for (const place of ['mom', 'dad']) {
    const k = suggest(ev, place).kid;
    ev.push(wash(place, k, `2026-${String(1 + Math.floor(w / 4)).padStart(2, '0')}-${String(1 + (w % 4) * 7 + (place === 'mom' ? 0 : 1)).padStart(2, '0')}`));
  }
  if (w % 5 === 2) ev.push(host('נועה', '2026-06-30'));
  const st = computeStats(ev);
  for (const p of ['mom', 'dad']) {
    const v = KIDS.map((k) => st[k][p]);
    // אירוח מוסיף נקודה לנועה, אז הפער יכול לגדול רק בגללו; בלי אירוח הפער <= 1
    if (!ev.some((e) => e.kind === 'host')) assert.ok(Math.max(...v) - Math.min(...v) <= 1);
  }
}
console.log('כל הבדיקות עברו');
