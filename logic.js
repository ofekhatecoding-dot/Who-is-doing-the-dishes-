// לוגיקת ההוגנות. פונקציות טהורות בלבד, בלי תלות בדפדפן, כדי שאפשר לבדוק אותן.

export const KIDS = ['נועה', 'נווה', 'אופק'];
export const PLACES = { mom: 'אמא', dad: 'אבא' };

// סוגי אירועים:
//  wash : מישהו שטף כלים אצל אמא או אבא      { kind:'wash', place:'mom'|'dad', washer, date, absent:[], suggested }
//  host : ילד אירח ארוחה, נחשב סבב שלם       { kind:'host', washer, date }
//  none : לא הייתה ארוחה / אין כלים לשטוף    { kind:'none', place, date }

export function sortEvents(events) {
  return [...events].sort(
    (a, b) =>
      (a.date || '').localeCompare(b.date || '') ||
      (a.createdAt || 0) - (b.createdAt || 0)
  );
}

export function computeStats(events, kids = KIDS) {
  const stats = Object.fromEntries(
    kids.map((k) => [k, { mom: 0, dad: 0, total: 0, lastMom: -1, lastDad: -1 }])
  );
  sortEvents(events).forEach((e, i) => {
    const s = stats[e.washer];
    if (!s) return;
    if (e.kind === 'wash' && (e.place === 'mom' || e.place === 'dad')) {
      s[e.place]++;
      s[e.place === 'mom' ? 'lastMom' : 'lastDad'] = i;
    } else if (e.kind === 'host') {
      // אירוח = סבב שלם: נספר גם אצל אמא וגם אצל אבא
      s.mom++;
      s.dad++;
      s.lastMom = i;
      s.lastDad = i;
    }
  });
  for (const k of kids) stats[k].total = stats[k].mom + stats[k].dad;
  return stats;
}

// מי התור הבא אצל הורה מסוים.
// כל הורה נספר בנפרד. מי שהכי פחות שטף אצל אותו הורה הוא הבא.
// בשוויון: מי ששטף שם הכי מזמן. אחר כך: מי שיש לו פחות שטיפות בסך הכול.
// ילדים ב-absent לא נכללים (לא היו בארוחה).
export function suggest(events, place, absent = [], kids = KIDS) {
  const stats = computeStats(events, kids);
  const countOf = (k) => stats[k][place];
  const lastOf = (k) => stats[k][place === 'mom' ? 'lastMom' : 'lastDad'];

  const ranking = kids
    .filter((k) => !absent.includes(k))
    .sort(
      (a, b) =>
        countOf(a) - countOf(b) ||
        lastOf(a) - lastOf(b) ||
        stats[a].total - stats[b].total ||
        kids.indexOf(a) - kids.indexOf(b)
    );

  if (!ranking.length) return { kid: null, reason: '', ranking: [] };

  const kid = ranking[0];
  const min = countOf(kid);
  const tied = ranking.filter((k) => countOf(k) === min);
  const where = PLACES[place];
  const reason =
    tied.length === 1
      ? `הכי פחות שטיפות אצל ${where} (${min})`
      : `שווה בשטיפות אצל ${where} (${min}), ושטף/ה שם הכי מזמן`;

  return { kid, reason, ranking };
}

export function todayStr(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
