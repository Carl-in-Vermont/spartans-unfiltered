const CACHE_NAME = "spartans-unfiltered-v1";

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache =>
      cache.addAll([
        "./",
        "./index.html",
        "./style.css",
        "./app.js",
        "./spartan-logo.jpg"
      ])
    )
  );
});
