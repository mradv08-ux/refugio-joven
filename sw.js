'use strict';
// Sube VERSION cada vez que cambies archivos publicados, o los móviles seguirán con la vieja.
const VERSION = 'refugio-joven-v5';
const SHELL = [
  './', 'index.html', 'styles.css', 'app.js', 'material.js', 'config.js', 'manifest.webmanifest', 'legal.html',
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
  ev.respondWith(
    caches.match(ev.request).then(r => r || fetch(ev.request).then(resp => {
      if (resp.ok && (url.origin === location.origin || url.hostname.includes('fonts.g'))) {
        const copia = resp.clone();
        caches.open(VERSION).then(c => c.put(ev.request, copia));
      }
      return resp;
    }).catch(() => caches.match('index.html')))
  );
});
