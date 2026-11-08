'use strict';
// Sube VERSION cada vez que cambies archivos publicados, o los móviles seguirán con la vieja.
const VERSION = 'refugio-joven-v9';
const SHELL = [
  './', 'index.html', 'styles.css', 'app.js', 'material.js', 'portal.js', 'escaner.js', 'mi.html', 'mi.js', 'mi.css', 'mi.webmanifest', 'config.js', 'manifest.webmanifest', 'legal.html',
  'img/logo.png', 'img/icono-192.png', 'img/icono-512.png', 'img/apple-touch-icon.png',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.js'
];

self.addEventListener('install', (ev) => {
  ev.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (ev) => {
  ev.waitUntil(
    caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (ev) => {
  const url = new URL(ev.request.url);
  // Los datos de Supabase nunca se guardan en caché
  if (ev.request.method !== 'GET' || url.hostname.endsWith('supabase.co')) return;
  const guardar = (resp) => {
    if (resp.ok && (url.origin === location.origin || url.hostname.includes('fonts.g') || url.hostname.includes('jsdelivr'))) {
      const copia = resp.clone();
      caches.open(VERSION).then(c => c.put(ev.request, copia));
    }
    return resp;
  };
  if (url.origin === location.origin) {
    // Archivos de la app: primero la red (así siempre tenéis la última versión); sin cobertura, la copia guardada
    ev.respondWith(
      fetch(ev.request, { cache: 'no-cache' }).then(guardar)
        .catch(() => caches.match(ev.request).then(r => r || caches.match('index.html')))
    );
  } else {
    // Librerías y fuentes (no cambian): primero la copia guardada
    ev.respondWith(caches.match(ev.request).then(r => r || fetch(ev.request).then(guardar)));
  }
});
