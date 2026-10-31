// Service worker Buku Kas — Les Private BNA
// - Halaman aplikasi: selalu ambil versi TERBARU dari internet; kalau internet
//   lambat (>4 detik) atau putus, pakai salinan terakhir yang tersimpan di HP.
// - Pustaka (Firebase, font, html2canvas) & ikon: disimpan di HP supaya cepat dibuka.
// - Data (Firestore) TIDAK pernah disimpan di sini — selalu langsung dari Firebase.
const CACHE = 'bna-app-v2';
const CORE = ['./', './index.html', './manifest.json', './manifest-absen.json', './icon-192.png', './icon-512.png', './icon-absen-192.png', './icon-absen-512.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(CORE)).catch(() => {}).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('bna-app-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function isAppPage(url) {
  const scope = new URL(self.registration.scope).pathname;
  return url.origin === self.location.origin && (url.pathname === scope || url.pathname === scope + 'index.html');
}
function isStaticAsset(url) {
  return /^https:\/\/(www\.gstatic\.com\/firebasejs\/|cdnjs\.cloudflare\.com\/|fonts\.googleapis\.com\/|fonts\.gstatic\.com\/)/.test(url.href)
    || (url.origin === self.location.origin && /\/icon-[^/]+\.png$/.test(url.pathname));
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (req.mode === 'navigate' && isAppPage(url)) {
    e.respondWith(networkFirst(req));
  } else if (isStaticAsset(url)) {
    e.respondWith(cacheFirst(req));
  }
});

async function networkFirst(req) {
  const cache = await caches.open(CACHE);
  const key = new URL('./index.html', self.registration.scope).href;
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 4000);
    const res = await fetch(req, { signal: ctrl.signal, cache: 'no-store' });
    clearTimeout(timer);
    if (res.ok) cache.put(key, res.clone());
    return res;
  } catch (err) {
    const hit = await cache.match(key);
    if (hit) return hit;
    return fetch(req);
  }
}

async function cacheFirst(req) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok || res.type === 'opaque') cache.put(req, res.clone());
  return res;
}
