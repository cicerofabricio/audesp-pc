/**
 * mascara.js — formatação e digitação guiada dos campos do leiaute.
 * O dado gravado é sempre o valor canônico (só dígitos ou número);
 * a máscara existe apenas na exibição.
 */

export const soDigitos = (v) => String(v ?? '').replace(/\D+/g, '');

export function formatarCPF(valor) {
  const d = soDigitos(valor).slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

export function formatarCNPJ(valor) {
  const d = soDigitos(valor).slice(0, 14);
  if (d.length <= 2) return d;
  if (d.length <= 5) return `${d.slice(0, 2)}.${d.slice(2)}`;
  if (d.length <= 8) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5)}`;
  if (d.length <= 12) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8)}`;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}

/** Agrupa milhares com ponto e fecha em vírgula com `casas` decimais. */
export function formatarNumero(valor, casas = 2) {
  const n = typeof valor === 'number' ? valor : Number(String(valor).replace(/\./g, '').replace(',', '.'));
  if (!isFinite(n)) return '';
  return n.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas });
}

/** Quantos dígitos existem antes da posição do cursor. */
export function digitosAntes(texto, posicao) {
  return soDigitos(String(texto).slice(0, posicao)).length;
}

/** Posição do cursor depois de `n` dígitos no texto formatado. */
export function posicaoAposDigitos(formatado, n) {
  if (n <= 0) return 0;
  let contados = 0;
  for (let i = 0; i < formatado.length; i++) {
    if (/\d/.test(formatado[i])) {
      contados++;
      if (contados === n) return i + 1;
    }
  }
  return formatado.length;
}

/** Descobre o tipo de máscara a partir do schema. */
export function tipoDeMascara(node) {
  const p = (node && node.pattern) || '';
  if (p === '^[0-9]{11}$') return { tipo: 'cpf', max: 11, formato: formatarCPF, exemplo: '000.000.000-00' };
  if (p === '^[0-9]{14}$') return { tipo: 'cnpj', max: 14, formato: formatarCNPJ, exemplo: '00.000.000/0000-00' };
  const m = /^\^\[0-9\]\{(\d+)(?:,(\d+))?\}\$$/.exec(p);
  if (m) {
    const max = Number(m[2] || m[1]);
    return { tipo: 'digitos', max, formato: (d) => d, exemplo: `apenas números (${max} dígitos)` };
  }
  if (p === '^[0-9]+$') return { tipo: 'digitos', max: 30, formato: (d) => d, exemplo: 'apenas números' };
  return null;
}

/** Formata a máscara de acordo com o tipo, mantendo o cursor estável. */
export function aplicarMascara(input, mascara) {
  const antes = input.selectionStart ?? input.value.length;
  const qtdDigitos = digitosAntes(input.value, antes);
  const digitos = soDigitos(input.value).slice(0, mascara.max);
  const texto = mascara.formato(digitos);
  input.value = texto;
  const pos = posicaoAposDigitos(texto, qtdDigitos);
  try { input.setSelectionRange(pos, pos); } catch { /* alguns tipos de input não suportam */ }
  return digitos;
}
