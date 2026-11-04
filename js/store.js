/**
 * store.js — persistência local (IndexedDB, com fallback para localStorage).
 * Nenhum dado sai do navegador do usuário.
 */

const DB_NAME = 'audesp-pc';
const DB_VERSION = 1;
const STORE = 'registros';
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

function tx(mode) {
  return db().then((d) => d.transaction(STORE, mode).objectStore(STORE));
}

export function storageMode() {
  return fallback ? 'localStorage' : (('indexedDB' in window) ? 'IndexedDB' : 'memória');
}

export async function listRecords() {
  try {
    const store = await tx('readonly');
    return await new Promise((res, rej) => {
      const req = store.getAll();
      req.onsuccess = () => res(req.result || []);
      req.onerror = () => rej(req.error);
    });
  } catch {
    return lsAll();
  }
}

export async function getRecord(id) {
  try {
    const store = await tx('readonly');
    return await new Promise((res, rej) => {
      const req = store.get(id);
      req.onsuccess = () => res(req.result || null);
      req.onerror = () => rej(req.error);
    });
  } catch {
    return lsAll().find((r) => r.id === id) || null;
  }
}

export async function saveRecord(record) {
  const rec = { ...record, atualizado: new Date().toISOString() };
  try {
    const store = await tx('readwrite');
    await new Promise((res, rej) => {
      const req = store.put(rec);
      req.onsuccess = () => res();
      req.onerror = () => rej(req.error);
    });
  } catch {
    const all = lsAll().filter((r) => r.id !== rec.id);
    all.push(rec);
    lsSave(all);
  }
  return rec;
}

export async function deleteRecord(id) {
  try {
    const store = await tx('readwrite');
    await new Promise((res, rej) => {
      const req = store.delete(id);
      req.onsuccess = () => res();
      req.onerror = () => rej(req.error);
    });
  } catch {
    lsSave(lsAll().filter((r) => r.id !== id));
  }
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

export function getPrefs() {
  try { return JSON.parse(localStorage.getItem(PREF_KEY) || '{}'); } catch { return {}; }
}

export function setPrefs(patch) {
  const next = { ...getPrefs(), ...patch };
  try { localStorage.setItem(PREF_KEY, JSON.stringify(next)); } catch { /* ignora */ }
  return next;
}
