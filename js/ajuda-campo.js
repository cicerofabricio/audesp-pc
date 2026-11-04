/**
 * ajuda-campo.js — explicação detalhada de cada campo, montada a partir do schema.
 */

import { el } from './util.js';
import { resolve, nodeType, enumOptions } from './schema.js';

const ROTULO_TIPO = {
  string: 'Texto',
  integer: 'Número inteiro (sem casas decimais)',
  number: 'Número decimal',
  boolean: 'Sim / Não',
  object: 'Bloco de campos',
  array: 'Lista de itens',
};

/** Explicações específicas de campos que o schema sozinho não deixa claros. */
const DICAS = {
  documento_numero: 'Aceita somente números. O tamanho e a formatação seguem o “Tipo do Documento do Credor”: CPF (11 dígitos, 000.000.000-00), CNPJ (14 dígitos, 00.000.000/0000-00) ou RNE (até 14 caracteres). Ao trocar o tipo, o número é apagado para você digitar no formato novo. O arquivo enviado ao Audesp leva apenas os dígitos, sem pontos, barra ou traço.',
  documento_tipo: 'Define a máscara do número ao lado: 1 = CPF, 2 = CNPJ, 3 = RNE (documento de estrangeiro).',
  descritor: 'Identifica o documento no Audesp. O mês é sempre 12 (prestação anual) e o ano não pode ser anterior a 2024.',
  codigo_ajuste: 'Número do ajuste no Audesp, com 15 a 19 dígitos, sem pontos ou traços (ex.: 2024000000000001).',
  tipo_documento: 'Indica qual instrumento está sendo prestado (colaboração, fomento, parceria, convênio ou contrato de gestão).',
};

function descreverFormato(node) {
  const p = node.pattern || '';
  if (p === '^[0-9]{11}$') return 'CPF com 11 dígitos (o sistema insere os pontos e o traço automaticamente).';
  if (p === '^[0-9]{14}$') return 'CNPJ com 14 dígitos (o sistema insere pontos, barra e traço).';
  const m = /^\^\[0-9\]\{(\d+)(?:,(\d+))?\}\$$/.exec(p);
  if (m) return `Somente números, com ${m[2] ? `de ${m[1]} a ${m[2]}` : m[1]} dígito(s).`;
  if (p === '^[0-9]+$') return 'Somente números.';
  if (p === '\\S') return 'Texto livre, mas não pode ficar em branco.';
  if (node.format === 'date') return 'Data no formato AAAA-MM-DD (o campo já abre o calendário).';
  if (node.format === 'uri') return 'Endereço completo, começando por http:// ou https://.';
  return null;
}

function limites(node) {
  const partes = [];
  if (typeof node.minimum === 'number') partes.push(`mínimo ${String(node.minimum).replace('.', ',')}`);
  if (typeof node.maximum === 'number') partes.push(`máximo ${String(node.maximum).replace('.', ',')}`);
  if (typeof node.minLength === 'number' && node.minLength > 0) partes.push(`pelo menos ${node.minLength} caractere(s)`);
  if (typeof node.maxLength === 'number') partes.push(`até ${node.maxLength} caractere(s)`);
  if (typeof node.multipleOf === 'number' && node.multipleOf > 0 && node.multipleOf < 1) {
    partes.push(`no máximo ${Math.round(-Math.log10(node.multipleOf))} casas decimais`);
  }
  if (typeof node.minItems === 'number') partes.push(`pelo menos ${node.minItems} item(ns)`);
  if (typeof node.maxItems === 'number') partes.push(`até ${node.maxItems} item(ns)`);
  return partes.length ? `Limites: ${partes.join('; ')}.` : null;
}

/** Devolve os nós de conteúdo do balão de ajuda. */
export function conteudoAjuda(doc, nodeRaw, chave, obrigatorio) {
  const node = resolve(doc, nodeRaw) || {};
  const tipo = nodeType(doc, node);
  const itens = [];

  itens.push(el('li', {}, obrigatorio ? 'Campo obrigatório no leiaute do Audesp.' : 'Campo opcional — deixe em branco se não se aplicar.'));
  itens.push(el('li', {}, `Tipo: ${ROTULO_TIPO[tipo] || 'texto'}.`));

  const formato = descreverFormato(node);
  if (formato) itens.push(el('li', {}, formato));

  const lim = limites(node);
  if (lim) itens.push(el('li', {}, lim));

  if (Array.isArray(node.enum) && node.enum.length) {
    const opcoes = enumOptions(doc, node);
    const visiveis = opcoes.slice(0, 8);
    const lista = el('ul', { class: 'ajuda-dominio' },
      visiveis.map((o) => el('li', {}, o.label)),
      opcoes.length > visiveis.length ? el('li', {}, `… e mais ${opcoes.length - visiveis.length} opção(ões).`) : null,
    );
    itens.push(el('li', {}, `Valores aceitos (${opcoes.length}):`, lista));
  } else if (Array.isArray(node.enum) === false && node.const !== undefined) {
    itens.push(el('li', {}, `Valor fixo: ${node.const}.`));
  }

  const exemplo = (node.examples || []).find((e) => typeof e !== 'object' && !/^\d+\s*[=\-–]/.test(String(e)));
  if (exemplo !== undefined) itens.push(el('li', {}, `Exemplo do leiaute: ${exemplo}.`));

  const dica = DICAS[chave];
  if (dica) itens.push(el('li', {}, dica));

  if (tipo === 'array') {
    itens.push(el('li', {}, 'Use “Adicionar” para incluir itens; cada item pode ser duplicado (⧉) ou removido (✕).'));
  }

  return [
    el('h4', {}, node.title || chave),
    el('ul', { class: 'ajuda-itens' }, itens),
    el('p', { class: 'mini' }, 'Detalhes completos no manual oficial, na aba Documentação.'),
  ];
}

/** Texto curtíssimo para o atributo title do rótulo. */
export function resumoAjuda(doc, nodeRaw) {
  const node = resolve(doc, nodeRaw) || {};
  const partes = [];
  const formato = descreverFormato(node);
  if (formato) partes.push(formato);
  const lim = limites(node);
  if (lim) partes.push(lim);
  return partes.join(' ');
}
