/* ===== 畑メモ Service Worker（批次2：バージョン化）===== */
'use strict';

/* バージョンを上げると activate で旧キャッシュを全掃除 */
const CACHE_NAME = 'hatake-memo-v0.1.2';

const ASSETS = [
  './',
  './index.html',
  './app.js',
  './style.css',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './icon-180.png',
];

/* インストール：全静的資源をプリキャッシュ */
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

/* 有効化：このバージョン以外のキャッシュを全削除 */
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

/* HTML ナビゲーションかどうか */
function isHTMLRequest(req) {
  return req.mode === 'navigate' ||
    (req.headers.get('accept') || '').includes('text/html');
}

/*
  取得戦略：
   - HTML（ページ本体）= network-first（失敗時はキャッシュへ回退）
   - 静的資源          = cache-first（あれば即返し、無ければ取得してキャッシュ）
*/
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  if (isHTMLRequest(req)) {
    // network-first
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put(req, copy));
          return res;
        })
        .catch(() =>
          caches.match(req).then((cached) => cached || caches.match('./index.html'))
        )
    );
    return;
  }

  // cache-first
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(CACHE_NAME).then((c) => c.put(req, copy));
        return res;
      });
    })
  );
});
