// שומר את קבצי האפליקציה במטמון כדי שתיפתח מהר גם בלי רשת.
// הנתונים עצמם מגיעים מ-Firebase (שמחזיק מטמון משלו).
const CACHE = 'dishes-v1';
const FILES = [
  './', 'index.html', 'style.css', 'app.js', 'logic.js', 'store.js',
  'firebase-config.js', 'manifest.webmanifest', 'icons/icon.svg',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

// קודם מהרשת (כדי לקבל עדכונים), ואם אין רשת אז מהמטמון.
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy));
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});
