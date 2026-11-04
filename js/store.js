/**
 * store.js — persistência local: registros, histórico de versões e configuração.
 * IndexedDB com queda para localStorage; nada sai do navegador.
 */

const DB_NAME = 'audesp-pc';
const DB_VERSION = 2;
const STORE = 'registros';
const HIST = 'historico';
const CONFIG = 'config';
const LS_KEY = 'audesp-pc:registros';
const PREF_KEY = 'audesp-pc:preferencias';

let dbPromise = null;
let fallback = false;

function openDb() {
  if (!('indexedDB' in window)) return Promise.reject(new Error('IndexedDB indisponível'));
  return new Promise((res, rej) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'id' });
      if (!db.objectStoreNames.contains(HIST)) {
        const h = db.createObjectStore(HIST, { keyPath: 'id' });
        h.createIndex('registroId', 'registroId', { unique: false });
      }
      if (!db.objectStoreNames.contains(CONFIG)) db.createObjectStore(CONFIG, { keyPath: 'chave' });
    };
    req.onsuccess = () => res(req.result);
    req.onerror = () => rej(req.error || new Error('falha ao abrir banco'));
  });
}

async function db() {
  if (fallback) throw new Error('modo local');
  if (!dbPromise) {
    dbPromise = openDb().catch((err) => {
      fallback = true;
      console.warn('IndexedDB indisponível, usando localStorage:', err);
      throw err;
    });
  }
  return dbPromise;
}

function lsAll() {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || '[]'); } catch { return []; }
}
function lsSave(records) {
  localStorage.setItem(LS_KEY, JSON.stringify(records));
}

async function store(nome, modo) {
  const d = await db();
  return d.transaction(nome, modo).objectStore(nome);
}

function pedido(request) {
  return new Promise((res, rej) => {
    request.onsuccess = () => res(request.result);
    request.onerror = () => rej(request.error);
  });
}

export function storageMode() {
  return fallback ? 'localStorage' : (('indexedDB' in window) ? 'IndexedDB' : 'memória');
}

/* ------------------------------------------------------------------ registros */

export async function listRecords() {
  try {
    const s = await store(STORE, 'readonly');
    return (await pedido(s.getAll())) || [];
  } catch {
    return lsAll();
  }
}

export async function getRecord(id) {
  try {
    const s = await store(STORE, 'readonly');
    return (await pedido(s.get(id))) || null;
  } catch {
    return lsAll().find((r) => r.id === id) || null;
  }
}

export async function saveRecord(record) {
  const rec = { ...record, atualizado: new Date().toISOString() };
  try {
    const s = await store(STORE, 'readwrite');
    await pedido(s.put(rec));
  } catch {
    const all = lsAll().filter((r) => r.id !== rec.id);
    all.push(rec);
    lsSave(all);
  }
  return rec;
}

export async function deleteRecord(id) {
  try {
    const s = await store(STORE, 'readwrite');
    await pedido(s.delete(id));
  } catch {
    lsSave(lsAll().filter((r) => r.id !== id));
  }
  await limparHistorico(id);
}

export async function importRecords(records) {
  let n = 0;
  for (const rec of records) {
    if (!rec || !rec.tipo || !rec.dados) continue;
    if (!rec.id) rec.id = crypto.randomUUID ? crypto.randomUUID() : 'id-' + Date.now() + Math.random();
    await saveRecord(rec);
    n++;
  }
  return n;
}

/* ------------------------------------------------------------------ histórico */

const MAX_SNAPSHOTS = 30;

/** Guarda uma versão do documento. Retorna true se gravou. */
export async function salvarSnapshot(registroId, dados) {
  try {
    const s = await store(HIST, 'readwrite');
    const id = `${registroId}|${Date.now()}|${Math.random().toString(36).slice(2, 7)}`;
    await pedido(s.put({ id, registroId, quando: new Date().toISOString(), dados: JSON.parse(JSON.stringify(dados)) }));
    const antigos = await listarHistorico(registroId);
    if (antigos.length > MAX_SNAPSHOTS) {
      const s2 = await store(HIST, 'readwrite');
      for (const velho of antigos.slice(MAX_SNAPSHOTS)) await pedido(s2.delete(velho.id));
    }
    return true;
  } catch (err) {
    console.warn('histórico indisponível:', err);
    return false;
  }
}

/** Versões do mais recente para o mais antigo. */
export async function listarHistorico(registroId) {
  try {
    const d = await db();
    const s = d.transaction(HIST, 'readonly').objectStore(HIST);
    const itens = (await pedido(s.index('registroId').getAll(registroId))) || [];
    return itens.sort((a, b) => String(b.quando).localeCompare(String(a.quando)));
  } catch {
    return [];
  }
}

export async function limparHistorico(registroId) {
  try {
    const itens = await listarHistorico(registroId);
    const s = await store(HIST, 'readwrite');
    for (const item of itens) await pedido(s.delete(item.id));
  } catch { /* ignora */ }
}

/* ------------------------------------------------------------------ configuração */

export async function getConfig(chave) {
  try {
    const s = await store(CONFIG, 'readonly');
    const item = await pedido(s.get(chave));
    return item ? item.valor : null;
  } catch {
    try {
      const bruto = localStorage.getItem(`audesp-pc:cfg:${chave}`);
      return bruto ? JSON.parse(bruto) : null;
    } catch { return null; }
  }
}

export async function setConfig(chave, valor) {
  try {
    const s = await store(CONFIG, 'readwrite');
    await pedido(s.put({ chave, valor }));
  } catch {
    try {
      if (valor === null || valor === undefined) localStorage.removeItem(`audesp-pc:cfg:${chave}`);
      else localStorage.setItem(`audesp-pc:cfg:${chave}`, JSON.stringify(valor));
    } catch { /* ignora */ }
  }
}

/* ------------------------------------------------------------------ preferências */

export function getPrefs() {
  try { return JSON.parse(localStorage.getItem(PREF_KEY) || '{}'); } catch { return {}; }
}

export function setPrefs(patch) {
  const next = { ...getPrefs(), ...patch };
  try { localStorage.setItem(PREF_KEY, JSON.stringify(next)); } catch { /* ignora */ }
  return next;
}
