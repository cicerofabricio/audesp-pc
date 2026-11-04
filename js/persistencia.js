/**
 * persistencia.js — gravação contínua em arquivo local (File System Access API).
 *
 * Permite vincular o registro a um arquivo .json (por exemplo dentro de uma
 * pasta do Google Drive) e sobrescrevê-lo a cada alteração. Funciona em
 * navegadores Chromium (Chrome/Edge); nos demais, resta o download manual.
 */

import { getConfig, setConfig } from './store.js';
import { serializar, nomeArquivo } from './exportar.js';

const CHAVE = 'arquivoVinculado';

export const suportaArquivoLocal = () => typeof window !== 'undefined' && typeof window.showSaveFilePicker === 'function';

export async function arquivoVinculado() {
  try {
    const handle = await getConfig(CHAVE);
    return handle && handle.createWritable ? handle : null;
  } catch {
    return null;
  }
}

export async function desvincularArquivo() {
  try { await setConfig(CHAVE, null); } catch { /* ignora */ }
}

async function garantirPermissao(handle, pedir) {
  if (!handle.queryPermission) return true;
  const estado = await handle.queryPermission({ mode: 'readwrite' });
  if (estado === 'granted') return true;
  if (!pedir || !handle.requestPermission) return false;
  const novo = await handle.requestPermission({ mode: 'readwrite' });
  return novo === 'granted';
}

async function escrever(handle, texto) {
  const w = await handle.createWritable();
  await w.write(texto);
  await w.close();
}

/** Abre o seletor de arquivo, vincula e grava o estado atual. */
export async function vincularArquivo(rec) {
  if (!suportaArquivoLocal()) {
    throw new Error('Este navegador não permite salvar direto em arquivo. Use “Baixar JSON”.');
  }
  const handle = await window.showSaveFilePicker({
    suggestedName: nomeArquivo(rec),
    types: [{ description: 'JSON do Audesp', accept: { 'application/json': ['.json'] } }],
  });
  const ok = await garantirPermissao(handle, true);
  if (!ok) throw new Error('Permissão de escrita não concedida.');
  await escrever(handle, serializar(rec));
  await setConfig(CHAVE, handle);
  return handle;
}

/** Sobrescreve o arquivo vinculado. Lança erro se a permissão tiver sido revogada. */
export async function salvarNoArquivo(rec) {
  const handle = await arquivoVinculado();
  if (!handle) return false;
  const ok = await garantirPermissao(handle, false);
  if (!ok) throw new Error('Permissão de escrita expirada — vincule o arquivo novamente.');
  await escrever(handle, serializar(rec));
  return true;
}

export function nomeDoArquivoVinculado(handle) {
  return handle && handle.name ? handle.name : 'arquivo vinculado';
}
