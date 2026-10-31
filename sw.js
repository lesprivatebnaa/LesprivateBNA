// Service worker Buku Kas — Les Private BNA
// - Halaman aplikasi: langsung dibuka dari salinan di HP (instan, seperti
//   aplikasi asli). Versi terbaru diambil di latar belakang; kalau ada yang
//   berubah, aplikasi menampilkan tombol "Versi baru tersedia".
// - Pustaka (Firebase, font, html2canvas) & ikon: disimpan di HP.
// - Data (Firestore) TIDAK pernah disimpan di sini — selalu dari Firebase.
const CACHE = 'bna-app-v3';
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
    e.respondWith(appShell(req, e));
  } else if (isStaticAsset(url)) {
    e.respondWith(cacheFirst(req));
  }
});

async function appShell(req, event) {
  const cache = await caches.open(CACHE);
  const key = new URL('./index.html', self.registration.scope).href;
  const cached = await cache.match(key);
  const oldText = cached ? cached.clone().text() : Promise.resolve(null);
  const refresh = fetch(req.url, { cache: 'no-store', credentials: 'same-origin' }).then(async (res) => {
    if (res.ok) {
      const fresh = await res.clone().text();
      const old = await oldText;
      await cache.put(key, new Response(fresh, { headers: { 'Content-Type': 'text/html; charset=utf-8' } }));
      if (old !== null && old !== fresh) {
        // beri waktu halaman memasang pendengarnya
        await new Promise((r) => setTimeout(r, 1500));
        const wins = await self.clients.matchAll({ type: 'window' });
        wins.forEach((w) => w.postMessage({ type: 'bna-update' }));
      }
    }
    return res;
  });
  if (cached) {
    event.waitUntil(refresh.catch(() => {}));
    return cached;
  }
  return refresh;
}

async function cacheFirst(req) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok || res.type === 'opaque') cache.put(req, res.clone());
  return res;
}
