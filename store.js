// שכבת אחסון. אם הוגדר Firebase משתמשים בו (סנכרון בין כל הטלפונים).
// אם לא, עובדים במצב הדגמה עם localStorage (המכשיר הזה בלבד).

import { firebaseConfig } from './firebase-config.js';

const FB = 'https://www.gstatic.com/firebasejs/10.14.1';

export async function createStore() {
  if (firebaseConfig && firebaseConfig.apiKey) {
    try {
      return await firebaseStore();
    } catch (err) {
      console.error('Firebase init failed, falling back to local mode', err);
    }
  }
  return localStore();
}

async function firebaseStore() {
  const { initializeApp } = await import(`${FB}/firebase-app.js`);
  const fs = await import(`${FB}/firebase-firestore.js`);
  const app = initializeApp(firebaseConfig);
  const db = fs.initializeFirestore(app, { localCache: fs.persistentLocalCache() });
  const col = fs.collection(db, 'events');

  return {
    mode: 'cloud',
    subscribe(cb, onError) {
      return fs.onSnapshot(
        fs.query(col, fs.orderBy('date')),
        (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
        (err) => onError && onError(err)
      );
    },
    async add(ev) {
      const ref = await fs.addDoc(col, ev);
      return ref.id;
    },
    async remove(id) {
      await fs.deleteDoc(fs.doc(db, 'events', id));
    },
  };
}

function localStore() {
  const KEY = 'dishes.events.v1';
  const read = () => {
    try {
      return JSON.parse(localStorage.getItem(KEY)) || [];
    } catch {
      return [];
    }
  };
  const write = (list) => localStorage.setItem(KEY, JSON.stringify(list));
  const subs = new Set();
  const emit = () => subs.forEach((cb) => cb(read()));
  window.addEventListener('storage', (e) => e.key === KEY && emit());

  return {
    mode: 'local',
    subscribe(cb) {
      subs.add(cb);
      cb(read());
      return () => subs.delete(cb);
    },
    async add(ev) {
      const id = Math.random().toString(36).slice(2) + Date.now().toString(36);
      write([...read(), { id, ...ev }]);
      emit();
      return id;
    },
    async remove(id) {
      write(read().filter((e) => e.id !== id));
      emit();
    },
  };
}
