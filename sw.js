/* Service worker — permite usar o sistema offline depois da primeira visita. */

const VERSAO = 'audesp-pc-v1.16.1';
const ESSENCIAIS = [
  './',
  './index.html',
  './css/app.css',
  './manifest.webmanifest',
  './icone.svg',
  './js/app.js',
  './js/util.js',
  './js/schema.js',
  './js/validator.js',
  './js/store.js',
  './js/exportar.js',
  './js/ui/form.js',
  './js/ui/shell.js',
  './js/views/home.js',
  './js/views/editor.js',
  './js/views/conferencia.js',
  './js/views/ajuda.js',
  './js/views/docs.js',
  './dados/declaracao_negativa_schema_v1_16.json',
  './dados/declaracao_negativa_v1_16.json',
  './dados/prestacao_contas_contrato_gestao_schema_v1_16.json',
  './dados/prestacao_contas_contrato_gestao_v1_16.json',
  './dados/prestacao_contas_convenio_schema_v1_16.json',
  './dados/prestacao_contas_convenio_v1_16.json',
  './dados/prestacao_contas_termo_colaboracao_schema_v1_16.json',
  './dados/prestacao_contas_termo_colaboracao_v1_16.json',
  './dados/prestacao_contas_termo_fomento_schema_v1_16.json',
  './dados/prestacao_contas_termo_fomento_v1_16.json',
  './dados/prestacao_contas_termo_parceria_schema_v1_16.json',
  './dados/prestacao_contas_termo_parceria_v1_16.json',
];

self.addEventListener('install', (evento) => {
  evento.waitUntil(
    caches.open(VERSAO).then((cache) => cache.addAll(ESSENCIAIS)).then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (evento) => {
  evento.waitUntil(
    caches.keys()
      .then((chaves) => Promise.all(chaves.filter((k) => k !== VERSAO).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (evento) => {
  const req = evento.request;
  if (req.method !== 'GET' || !req.url.startsWith(self.location.origin)) return;
  evento.respondWith(
    caches.match(req).then((achado) => achado || fetch(req).then((resposta) => {
      const copia = resposta.clone();
      caches.open(VERSAO).then((cache) => cache.put(req, copia)).catch(() => {});
      return resposta;
    }).catch(() => caches.match('./index.html'))),
  );
});
