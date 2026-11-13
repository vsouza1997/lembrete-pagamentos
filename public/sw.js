const CACHE = 'lembretes-v1';

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (evento) => {
  evento.waitUntil(
    caches
      .keys()
      .then((chaves) => Promise.all(chaves.filter((c) => c !== CACHE).map((c) => caches.delete(c))))
      .then(() => self.clients.claim()),
  );
});

// Cache "stale-while-revalidate" só para o app e para as bibliotecas do Firebase no gstatic.
// Dados do Firestore têm cache próprio (persistentLocalCache).
self.addEventListener('fetch', (evento) => {
  const { request } = evento;
  const url = new URL(request.url);
  const permitido =
    request.method === 'GET' && (url.origin === self.location.origin || url.hostname === 'www.gstatic.com');
  if (!permitido) return;
  // Rotas do Firebase Auth (/__/auth/*, /__/firebase/*) nunca passam pelo cache.
  if (url.pathname.startsWith('/__/')) return;

  evento.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const emCache = await cache.match(request);
      const rede = fetch(request)
        .then((resposta) => {
          if (resposta.ok) cache.put(request, resposta.clone()).catch(() => {});
          return resposta;
        })
        .catch(() => emCache || Response.error());
      return emCache || rede;
    }),
  );
});
