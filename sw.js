// Сервис-воркер: приложение открывается быстро и запускается даже при слабой сети.
// Данные (баллы, карточки) всегда берутся с сервера, поэтому для работы нужен интернет.
const CACHE = "lemalar-v4";
const SHELL = ["./", "index.html", "style.css", "config.js", "manifest.webmanifest",
  "js/util.js", "js/mock.js", "js/gas.js", "js/data.js", "js/student.js", "js/teacher.js", "js/app.js",
  "icons/icon-192.png", "icons/icon-512.png", "icons/apple-touch-icon.png"];
self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET" || new URL(req.url).origin !== location.origin) return;
  // сначала сеть (всегда свежая версия и настройки), кэш — только если нет интернета
  e.respondWith(caches.open(CACHE).then(async (cache) => {
    try {
      const res = await fetch(req, { cache: "no-cache" });
      if (res.ok) cache.put(req, res.clone());
      return res;
    } catch (err) {
      const hit = await cache.match(req, { ignoreSearch: true });
      if (hit) return hit;
      throw err;
    }
  }));
});
