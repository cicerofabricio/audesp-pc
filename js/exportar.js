/**
 * exportar.js — geração do arquivo JSON no padrão Audesp.
 */

import { TIPOS } from './schema.js';
import { download, fmtDateBR } from './util.js';

/** Nome de arquivo seguro e identificável: <schema>_<municipio>-<entidade>-<ano>-<mes>.json */
export function nomeArquivo(rec) {
  const tipo = TIPOS[rec.tipo] || { arquivo: rec.tipo };
  const d = (rec.dados && rec.dados.descritor) || {};
  const partes = [d.municipio, d.entidade, d.ano, d.mes]
    .map((v) => (v === undefined || v === null || v === '' ? 'x' : String(v).replace(/[^\w-]+/g, '')))
    .join('-');
  return `${tipo.arquivo}_${partes}.json`;
}

export function serializar(rec) {
  return JSON.stringify(rec.dados ?? {}, null, 2);
}

export function baixarRegistro(rec) {
  download(nomeArquivo(rec), serializar(rec));
}

/** Resumo curto do descritor para títulos de cartão. */
export function resumoDescritor(rec) {
  const d = (rec.dados && rec.dados.descritor) || {};
  const ref = d.mes && d.ano ? `${String(d.mes).padStart(2, '0')}/${d.ano}` : '—';
  const mun = d.municipio ? `Município ${d.municipio}` : 'Município —';
  const ent = d.entidade ? `Entidade ${d.entidade}` : 'Entidade —';
  return { ref, mun, ent, codigo: rec.dados?.codigo_ajuste || '' };
}

/** Identifica o tipo interno a partir do campo descritor.tipo_documento. */
export function tipoPorDocumento(tipoDocumento) {
  const alvo = String(tipoDocumento || '').toLowerCase();
  for (const [key, def] of Object.entries(TIPOS)) {
    if (alvo === `prestação de contas de ${def.nome}`.toLowerCase()) return key;
  }
  if (alvo.includes('contrato de gestão')) return 'contrato_gestao';
  if (alvo.includes('convênio')) return 'convenio';
  if (alvo.includes('colaboração')) return 'termo_colaboracao';
  if (alvo.includes('fomento')) return 'termo_fomento';
  if (alvo.includes('parceria')) return 'termo_parceria';
  return null;
}

export function dataCurta(iso) {
  return fmtDateBR(iso);
}
