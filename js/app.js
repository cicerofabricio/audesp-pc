/**
 * app.js — bootstrap, carregamento dos schemas e roteamento por hash.
 */

import { TIPOS, ORDEM_TIPOS, createDoc, arquivoSchema } from './schema.js';
import { renderHome } from './views/home.js';
import { renderEditor } from './views/editor.js';
import { renderAjuda } from './views/ajuda.js';
import { renderDocs } from './views/docs.js';
import { el } from './util.js';

const state = { schemas: {} };

const ctx = {
  get schemas() { return state.schemas; },
  navigate(hash) {
    if (location.hash === hash) route();
    else location.hash = hash;
  },
  refresh() { route(); },
};

async function carregarSchemas() {
  const pares = await Promise.all(ORDEM_TIPOS.map(async (key) => {
    const url = `dados/${arquivoSchema(key)}`;
    const res = await fetch(url, { cache: 'no-cache' });
    if (!res.ok) throw new Error(`Falha ao carregar ${url} (HTTP ${res.status})`);
    const raw = await res.json();
    return [key, createDoc(raw)];
  }));
  state.schemas = Object.fromEntries(pares);
}

function rotaAtual() {
  const bruto = location.hash.replace(/^#/, '') || '/';
  const [caminho, consulta] = bruto.split('?');
  const params = new URLSearchParams(consulta || '');
  const partes = caminho.split('/').filter(Boolean);
  if (partes[0] === 'edit' && partes[1]) return { nome: 'editor', id: decodeURIComponent(partes[1]), aba: params.get('aba') };
  if (partes[0] === 'docs') return { nome: 'docs' };
  if (partes[0] === 'ajuda') return { nome: 'ajuda' };
  return { nome: 'home' };
}

let renderizando = false;

async function route() {
  if (renderizando) return;
  renderizando = true;
  const app = document.getElementById('app');
  const rota = rotaAtual();
  document.body.dataset.rota = rota.nome;
  const avisos = document.getElementById('toasts');
  if (avisos) avisos.replaceChildren();
  try {
    if (rota.nome === 'editor') {
      await renderEditor(app, ctx, rota.id, rota.aba);
    } else if (rota.nome === 'docs') {
      renderDocs(app, ctx);
    } else if (rota.nome === 'ajuda') {
      renderAjuda(app, ctx);
    } else {
      await renderHome(app, ctx);
    }
    window.scrollTo({ top: 0, behavior: 'instant' });
  } catch (err) {
    console.error(err);
    app.replaceChildren(el('div', { class: 'falha' },
      el('h1', {}, 'Algo deu errado ao abrir esta tela'),
      el('p', {}, String(err && err.message ? err.message : err)),
      el('pre', {}, String(err && err.stack ? err.stack : '')),
      el('p', {}, el('a', { href: '#/' }, 'Voltar ao início')),
    ));
  } finally {
    renderizando = false;
  }
}

function telaFalha(err) {
  return el('div', { class: 'pagina' },
    el('div', { class: 'painel' },
      el('h1', { style: 'font-size:20px;margin-bottom:8px' }, 'Não foi possível carregar os schemas'),
      el('p', {}, 'O sistema precisa buscar os arquivos JSON da pasta ', el('code', {}, 'dados/'), '.'),
      el('pre', { class: 'dica' }, String(err && err.message ? err.message : err)),
      el('p', {}, 'Causas comuns: abrir o arquivo diretamente (file://) em vez do endereço publicado, ' +
        'ou a pasta dados/ não ter sido enviada junto com o restante do site.'),
      el('p', {}, 'Se estiver testando localmente, rode um servidor na pasta do projeto, por exemplo: ',
        el('code', {}, 'python -m http.server 8000')),
    ),
  );
}

(async function boot() {
  const app = document.getElementById('app');
  const carregando = el('div', { class: 'carregando' }, 'Carregando esquemas do Audesp…');
  app.replaceChildren(carregando);
  try {
    await carregarSchemas();
  } catch (err) {
    console.error(err);
    app.replaceChildren(telaFalha(err));
    return;
  }
  window.addEventListener('hashchange', route);
  route();

  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('sw.js').catch((e) => console.warn('service worker:', e));
  }
})();
