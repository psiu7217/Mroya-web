// Network-only: never store API responses, conversations, accounts or authenticated HTML.
self.addEventListener('install', () => { self.skipWaiting(); });
self.addEventListener('activate', event => { event.waitUntil(self.clients.claim()); });
self.addEventListener('fetch', event => {
  if (event.request.mode !== 'navigate' || new URL(event.request.url).origin !== self.location.origin || new URL(event.request.url).pathname.startsWith('/api/')) return;
  event.respondWith(fetch(event.request).catch(() => new Response(`<!doctype html>
<html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Mroya</title><style>body{margin:0;min-height:100dvh;display:grid;place-items:center;background:#FBF8F3;color:#302a24;font:16px system-ui}main{max-width:24rem;padding:2rem}button{padding:.8rem 1.2rem;border:0;border-radius:1rem;background:#785a36;color:white;cursor:pointer}@media(prefers-color-scheme:dark){body{background:#171513;color:#f5efe5}}</style>
<main><h1>Mroya</h1><p id="message">Connect to the internet to open Mroya.</p><button id="retry" onclick="location.reload()">Try again</button></main>
<script>var language;try{language=localStorage.getItem('mroya.language')}catch(_){}if(language==='ru'||(!language&&navigator.language.toLowerCase().startsWith('ru'))){document.documentElement.lang='ru';document.querySelector('h1').textContent='Мроя';document.getElementById('message').textContent='Подключитесь к интернету, чтобы открыть Мрою.';document.getElementById('retry').textContent='Попробовать снова';}</script></html>`, {
    status: 503,
    headers: {'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store'},
  })));
});
