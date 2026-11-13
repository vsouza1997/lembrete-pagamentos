const CACHE = 'lembretes-v2';

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (evento) => {
  evento.waitUntil(
    caches
      .keys()
      .then((chaves) => Promise.all(chaves.filter((c) => c !== CACHE).map((c) => caches.delete(c))))
      .then(() => self.clients.claim()),
  );
});

// Arquivos do próprio app: rede primeiro (atualizações aparecem na hora), cache só sem internet.
// Bibliotecas do Firebase no gstatic (URL com versão fixa): cache primeiro.
// Dados do Firestore têm cache próprio (persistentLocalCache).
self.addEventListener('fetch', (evento) => {
  const { request } = evento;
  const url = new URL(request.url);
  const doApp = url.origin === self.location.origin;
  const daBiblioteca = url.hostname === 'www.gstatic.com';
  if (request.method !== 'GET' || (!doApp && !daBiblioteca)) return;
  // Rotas do Firebase Auth (/__/auth/*, /__/firebase/*) nunca passam pelo cache.
  if (url.pathname.startsWith('/__/')) return;

  evento.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const emCache = await cache.match(request);
      if (daBiblioteca && emCache) return emCache;
      try {
        const resposta = await fetch(request);
        if (resposta.ok) cache.put(request, resposta.clone()).catch(() => {});
        return resposta;
      } catch {
        return emCache || Response.error();
      }
    }),
  );
});
