/**
 * util.js — utilidades de DOM, caminhos e formatação.
 * Sem dependências externas.
 */

/** Cria elemento DOM: el('div', {class:'x'}, filho, 'texto') */
export function el(tag, attrs, ...kids) {
  const node = document.createElement(tag);
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      if (v === null || v === undefined || v === false) continue;
      if (k === 'class') node.className = v;
      else if (k === 'dataset') Object.assign(node.dataset, v);
      else if (k === 'html') node.innerHTML = v;
      else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2).toLowerCase(), v);
      else if (k === 'text') node.textContent = v;
      else if (k in node) node[k] = v;
      else node.setAttribute(k, v);
    }
  }
  for (const kid of kids.flat(4)) {
    if (kid === null || kid === undefined || kid === false) continue;
    node.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
  }
  return node;
}

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

/* ------------------------------------------------------------------ caminhos */

export const pathKey = (path) => path.join('/');

export function getIn(obj, path) {
  let cur = obj;
  for (const step of path) {
    if (cur === null || cur === undefined) return undefined;
    cur = cur[step];
  }
  return cur;
}

export function setIn(obj, path, value) {
  let cur = obj;
  for (let i = 0; i < path.length - 1; i++) {
    const k = path[i];
    if (cur[k] === undefined || cur[k] === null || typeof cur[k] !== 'object') {
      cur[k] = typeof path[i + 1] === 'number' ? [] : {};
    }
    cur = cur[k];
  }
  cur[path[path.length - 1]] = value;
}

export function deleteIn(obj, path) {
  let cur = obj;
  for (let i = 0; i < path.length - 1; i++) {
    if (cur === null || cur === undefined) return;
    cur = cur[path[i]];
    if (cur === null || cur === undefined) return;
  }
  if (cur && typeof cur === 'object') {
    const last = path[path.length - 1];
    if (Array.isArray(cur)) cur.splice(last, 1);
    else delete cur[last];
  }
}

/* ------------------------------------------------------------------ valores */

export const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

/** Um valor conta como preenchido (para progresso e obrigatoriedade). */
export function isFilled(v) {
  if (v === undefined || v === null) return false;
  if (typeof v === 'string') return v.trim() !== '';
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === 'object') return Object.keys(v).length > 0;
  return true;
}

export const clone = (v) => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));

export const digitsOnly = (s) => String(s ?? '').replace(/\D+/g, '');

/* ------------------------------------------------------------------ formato */

const NF = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const NF0 = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 });

export const fmtNumber = (v, dec = 2) => (typeof v === 'number' && isFinite(v) ? (dec === 0 ? NF0 : NF).format(v) : '—');
export const fmtMoney = (v) => (typeof v === 'number' && isFinite(v) ? 'R$ ' + NF.format(v) : '—');
export const fmtDateBR = (iso) => {
  if (typeof iso !== 'string') return '—';
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
};
export const fmtDateTimeBR = (iso) => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d)) return '—';
  return d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
};

export function humanize(key) {
  if (!key) return '';
  const s = String(key).replace(/_/g, ' ').trim();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function todayISO() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function uid() {
  const c = globalThis.crypto;
  if (c && typeof c.randomUUID === 'function') return c.randomUUID();
  return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
}

export function debounce(fn, ms = 300) {
  let t = null;
  const wrapped = (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
  wrapped.flush = (...args) => { clearTimeout(t); fn(...args); };
  wrapped.cancel = () => clearTimeout(t);
  return wrapped;
}

export function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/** Baixa um arquivo de texto no navegador. */
export function download(filename, text, mime = 'application/json') {
  const blob = new Blob([text], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = el('a', { href: url, download: filename });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

/** Deep merge simples (b para dentro de a), usado ao carregar exemplos. */
export function deepMerge(a, b) {
  if (!isPlainObject(a) || !isPlainObject(b)) return clone(b);
  const out = clone(a);
  for (const [k, v] of Object.entries(b)) {
    out[k] = k in out ? deepMerge(out[k], v) : clone(v);
  }
  return out;
}
