/**
 * validator.js — validação contra o JSON Schema (subconjunto draft-07 usado pelo Audesp).
 * Também calcula o progresso de preenchimento por seção.
 */

import { resolve, nodeType } from './schema.js';
import { isFilled, isPlainObject } from './util.js';

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

function isRealDate(s) {
  const m = DATE_RE.exec(s);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return false;
  const dt = new Date(Date.UTC(y, mo - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d;
}

function isUri(s) {
  try {
    const u = new URL(s);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

function numLabel(n) {
  return String(n).replace('.', ',');
}

function patternMessage(node) {
  const p = node.pattern || '';
  const m = /^\^\[0-9\]\{(\d+)\}$/.exec(p);
  const m2 = /^\^\[0-9\]\{(\d+),(\d+)\}$/.exec(p);
  if (m) return `Informe ${m[1]} dígitos (somente números)`;
  if (m2) return `Informe de ${m2[1]} a ${m2[2]} dígitos (somente números)`;
  if (p === '^[0-9]+$') return 'Informe somente números';
  if (p === '\\S') return 'Informe um texto (não pode ficar em branco)';
  return 'Formato inválido para este campo';
}

function add(errors, path, message, keyword) {
  errors.push({ path, message, keyword });
}

/** Valida o documento inteiro. Retorna lista de {path, message, keyword, section}. */
export function validate(doc, data) {
  const errors = [];
  visit(doc, doc.raw, data, [], errors);
  for (const e of errors) e.section = e.path.length ? String(e.path[0]) : 'descritor';
  return errors;
}

function visit(doc, rawNode, value, path, errors) {
  const node = resolve(doc, rawNode);
  if (!node || typeof node !== 'object') return;
  if (value === undefined || value === null) return;

  const type = nodeType(doc, node);

  if (node.const !== undefined && value !== node.const) {
    add(errors, path, `O valor deve ser ${node.const}`, 'const');
  }

  if (type === 'object') {
    if (!isPlainObject(value)) return add(errors, path, 'Estrutura inválida (esperado um bloco de campos)', 'type');
    const props = node.properties || {};
    for (const key of node.required || []) {
      if (!isFilled(value[key])) {
        const filho = resolve(doc, props[key]);
        const tipoFilho = filho ? nodeType(doc, filho) : 'string';
        const msg = tipoFilho === 'array' ? 'Lista obrigatória não informada'
          : tipoFilho === 'object' ? 'Bloco obrigatório não informado'
            : 'Campo obrigatório';
        add(errors, [...path, key], msg, 'required');
      }
    }
    for (const [key, child] of Object.entries(props)) {
      if (value[key] !== undefined) visit(doc, child, value[key], [...path, key], errors);
    }
    if (node.additionalProperties === false) {
      for (const key of Object.keys(value)) {
        if (!(key in props)) add(errors, [...path, key], 'Campo não previsto neste documento', 'additionalProperties');
      }
    }
    if (typeof node.minProperties === 'number' && Object.keys(value).length < node.minProperties) {
      add(errors, path, `Informe ao menos ${node.minProperties} campo(s)`, 'minProperties');
    }
    if (typeof node.maxProperties === 'number' && Object.keys(value).length > node.maxProperties) {
      add(errors, path, `Máximo de ${node.maxProperties} campo(s)`, 'maxProperties');
    }
    return;
  }

  if (type === 'array') {
    if (!Array.isArray(value)) return add(errors, path, 'Informe uma lista de itens', 'type');
    if (typeof node.minItems === 'number' && value.length < node.minItems) {
      add(errors, path, `Inclua ao menos ${node.minItems} item(ns)`, 'minItems');
    }
    if (typeof node.maxItems === 'number' && value.length > node.maxItems) {
      add(errors, path, `Máximo de ${node.maxItems} item(ns)`, 'maxItems');
    }
    if (node.uniqueItems === true) {
      const seen = new Set();
      for (const v of value) {
        const k = JSON.stringify(v);
        if (seen.has(k)) { add(errors, path, 'Não repita itens iguais nesta lista', 'uniqueItems'); break; }
        seen.add(k);
      }
    }
    if (node.items) value.forEach((v, i) => visit(doc, node.items, v, [...path, i], errors));
    return;
  }

  if (type === 'boolean') {
    if (typeof value !== 'boolean') add(errors, path, 'Informe Sim ou Não', 'type');
    return;
  }

  if (type === 'integer' || type === 'number') {
    if (typeof value !== 'number' || !isFinite(value)) {
      return add(errors, path, type === 'integer' ? 'Informe um número inteiro' : 'Informe um número', 'type');
    }
    if (type === 'integer' && !Number.isInteger(value)) {
      return add(errors, path, 'Informe um número inteiro (sem casas decimais)', 'type');
    }
    if (typeof node.minimum === 'number' && value < node.minimum) {
      add(errors, path, `Valor mínimo: ${numLabel(node.minimum)}`, 'minimum');
    }
    if (typeof node.maximum === 'number' && value > node.maximum) {
      add(errors, path, `Valor máximo: ${numLabel(node.maximum)}`, 'maximum');
    }
    if (typeof node.multipleOf === 'number' && node.multipleOf > 0) {
      const r = value / node.multipleOf;
      if (Math.abs(r - Math.round(r)) > 1e-9) {
        add(errors, path, node.multipleOf < 1
          ? `Use no máximo ${Math.round(-Math.log10(node.multipleOf))} casas decimais`
          : `Use múltiplos de ${numLabel(node.multipleOf)}`, 'multipleOf');
      }
    }
    if (Array.isArray(node.enum) && !node.enum.includes(value)) add(errors, path, 'Selecione uma opção válida', 'enum');
    return;
  }

  // string
  if (typeof value !== 'string') return add(errors, path, 'Informe um texto', 'type');
  if (Array.isArray(node.enum) && !node.enum.includes(value)) add(errors, path, 'Selecione uma opção válida', 'enum');
  const len = [...value].length;
  if (typeof node.minLength === 'number' && len < node.minLength && len > 0) {
    add(errors, path, `Mínimo de ${node.minLength} caractere(s)`, 'minLength');
  } else if (typeof node.maxLength === 'number' && len > node.maxLength) {
    add(errors, path, `Máximo de ${node.maxLength} caractere(s)`, 'maxLength');
  }
  if (node.pattern) {
    let ok = true;
    try { ok = new RegExp(node.pattern, 'u').test(value); } catch { try { ok = new RegExp(node.pattern).test(value); } catch { ok = true; } }
    if (!ok) add(errors, path, patternMessage(node), 'pattern');
  }
  if (node.format === 'date' && !isRealDate(value)) add(errors, path, 'Data inválida — use AAAA-MM-DD', 'format');
  if (node.format === 'uri' && !isUri(value)) add(errors, path, 'Endereço inválido — inclua http:// ou https://', 'format');
}

/* ------------------------------------------------------------------ progresso */

function countPair(doc, rawNode, value) {
  const node = resolve(doc, rawNode);
  if (!node) return { req: 0, filled: 0 };
  const type = nodeType(doc, node);
  const present = isFilled(value);
  let req = 1;
  let filled = present ? 1 : 0;
  if (type === 'object') {
    for (const key of node.required || []) {
      const child = resolve(doc, (node.properties || {})[key]);
      const sub = countPair(doc, child, present ? value[key] : undefined);
      req += sub.req;
      filled += present ? sub.filled : 0;
    }
  }
  return { req, filled };
}

/** Progresso por seção e total (campos obrigatórios recursivos). */
export function stats(doc, data) {
  const sections = {};
  let req = 0;
  let filled = 0;
  for (const key of doc.sectionKeys) {
    const node = (doc.raw.properties || {})[key];
    const s = countPair(doc, node, data ? data[key] : undefined);
    sections[key] = s;
    req += s.req;
    filled += Math.min(s.filled, s.req);
  }
  return { sections, req, filled, pct: req ? Math.round((100 * filled) / req) : 0 };
}

/** Conjunto de caminhos com erro, para pintar o formulário. */
export function errorIndex(errors) {
  const byPath = new Map();
  const bySection = new Map();
  for (const e of errors) {
    const k = e.path.join('/');
    if (!byPath.has(k)) byPath.set(k, e.message);
    bySection.set(e.section, (bySection.get(e.section) || 0) + 1);
  }
  return { byPath, bySection };
}
