/* Сервис-воркер: офлайн-оболочка с версией кэша. */
var CACHE_VERSION = "durak-helper-v6";

var APP_SHELL = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./manifest.webmanifest",
  "./icons/icon.svg",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-maskable-512.png",
  "./icons/apple-touch-icon.png"
];

["S", "H", "D", "C"].forEach(function (suit) {
  ["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"].forEach(function (rank) {
    APP_SHELL.push("./cards/" + suit + rank + ".svg");
  });
});

self.addEventListener("install", function (e) {
  e.waitUntil(
    caches.open(CACHE_VERSION)
      .then(function (cache) { return cache.addAll(APP_SHELL); })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener("activate", function (e) {
  e.waitUntil(
    caches.keys()
      .then(function (keys) {
        return Promise.all(keys.map(function (k) {
          if (k !== CACHE_VERSION) return caches.delete(k);
        }));
      })
      .then(function () { return self.clients.claim(); })
  );
});

self.addEventListener("fetch", function (e) {
  var url = new URL(e.request.url);

  // только GET; шрифты Google Fonts кэшируем на лету
  if (e.request.method !== "GET") return;
  var isFont = url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com";
  if (!isFont && url.origin !== self.location.origin) return;

  e.respondWith(
    caches.match(e.request, { ignoreSearch: true }).then(function (hit) {
      if (hit) return hit;
      return fetch(e.request).then(function (resp) {
        if (resp && resp.ok && (isFont || url.origin === self.location.origin)) {
          var copy = resp.clone();
          caches.open(CACHE_VERSION).then(function (cache) { cache.put(e.request, copy); });
        }
        return resp;
      }).catch(function () {
        if (e.request.mode === "navigate") {
          return caches.match("./index.html");
        }
      });
    })
  );
});
