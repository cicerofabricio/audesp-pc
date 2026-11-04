/**
 * schema.js — leitura dos JSON Schemas do Audesp (draft-07) sem dependências.
 *
 * Os schemas usam $ref por ponteiro para o próprio documento:
 *   "#root/pagamentos/items/banco"  -> /pagamentos/items/banco
 *   "#/$defs/cpf"                   -> /$defs/cpf
 */

export const MONTHS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

/** Versão do leiaute Audesp usada nos nomes dos arquivos (dados/). */
export const VERSAO_SCHEMA = 'v1_16';
export const ROTULO_VERSAO = 'v1.16';

export const arquivoSchema = (key) => `${TIPOS[key].arquivo}_schema_${VERSAO_SCHEMA}.json`;
export const arquivoExemplo = (key) => `${TIPOS[key].arquivo}_${VERSAO_SCHEMA}.json`;

/** Catálogo dos documentos suportados (arquivos em dados/). */
export const TIPOS = {
  termo_colaboracao: {
    nome: 'Termo de Colaboração',
    arquivo: 'prestacao_contas_termo_colaboracao',
    curto: 'Colaboração',
    resumo: 'Parceria em que a Administração define o projeto e a organização da sociedade civil executa (Lei 13.019/2014).',
  },
  termo_fomento: {
    nome: 'Termo de Fomento',
    arquivo: 'prestacao_contas_termo_fomento',
    curto: 'Fomento',
    resumo: 'Parceria proposta pela organização da sociedade civil para execução de projeto próprio (Lei 13.019/2014).',
  },
  termo_parceria: {
    nome: 'Termo de Parceria',
    arquivo: 'prestacao_contas_termo_parceria',
    curto: 'Parceria',
    resumo: 'Ajuste firmado com Organização da Sociedade Civil de Interesse Público (OSCIP), nos termos da Lei 9.790/1999.',
  },
  convenio: {
    nome: 'Convênio',
    arquivo: 'prestacao_contas_convenio',
    curto: 'Convênio',
    resumo: 'Instrumento de repasse de recursos para execução de programa ou projeto em regime de mútua cooperação.',
  },
  contrato_gestao: {
    nome: 'Contrato de Gestão',
    arquivo: 'prestacao_contas_contrato_gestao',
    curto: 'Contrato de Gestão',
    resumo: 'Ajuste firmado com Organização Social (OS) para execução de atividades e metas pactuadas.',
  },
  declaracao_negativa: {
    nome: 'Declaração Negativa',
    arquivo: 'declaracao_negativa',
    curto: 'Declaração Negativa',
    resumo: 'Declaração de que não houve, no exercício, ajuste a ser prestado contas para o tipo de documento indicado.',
    simples: true,
  },
};

export const ORDEM_TIPOS = ['termo_colaboracao', 'termo_fomento', 'termo_parceria', 'convenio', 'contrato_gestao', 'declaracao_negativa'];

/** Agrupamento visual das seções (as chaves vêm do schema). */
export const GRUPOS = [
  { titulo: 'Identificação', chaves: ['descritor', 'codigo_ajuste', 'retificacao'] },
  { titulo: 'Pessoal', chaves: ['relacao_empregados', 'servidores_cedidos'] },
  { titulo: 'Bens e patrimônio', chaves: ['relacao_bens', 'termo_cessao_permissao_bens'] },
  { titulo: 'Compras, contratos e despesas', chaves: ['contratos', 'documentos_fiscais', 'pagamentos', 'empenhos', 'repasses'] },
  { titulo: 'Financeiro', chaves: ['disponibilidades', 'receitas', 'ajustes_saldo', 'descontos', 'devolucoes', 'glosas'] },
  { titulo: 'Execução e metas', chaves: ['relatorio_atividades', 'relatorio_monitoramento_avaliacao', 'relatorio_comissao_avaliacao', 'relatorio_governamental_analise_execucao'] },
  { titulo: 'Publicações legais', chaves: ['publicacao_regulamento_compras', 'publicacao_extrato_execucao_fisica_financeira', 'publicacao_relatorio_atividades', 'publicacoes_parecer_ata', 'demonstracoes_contabeis'] },
  { titulo: 'Entidade e órgão concessor', chaves: ['dados_gerais_entidade_beneficiaria', 'responsaveis_membros_orgao_concessor'] },
  { titulo: 'Declarações e conclusão', chaves: ['declaracoes', 'prestacao_contas_entidade_beneficiaria', 'parecer_conclusivo', 'transparencia'] },
];

/* ------------------------------------------------------------------ documento */

export function createDoc(raw) {
  const doc = { raw, defs: raw.$defs || raw.definitions || {}, anchors: new Map() };
  indexarAncoras(raw, doc.anchors);
  const all = raw.properties || {};
  doc.sectionKeys = Object.keys(all);
  doc.grupos = GRUPOS.map((g) => ({ titulo: g.titulo, chaves: g.chaves.filter((k) => k in all) }));
  const agrupadas = new Set(doc.grupos.flatMap((g) => g.chaves));
  const resto = doc.sectionKeys.filter((k) => !agrupadas.has(k));
  if (resto.length) doc.grupos.push({ titulo: 'Outros', chaves: resto });
  return doc;
}

/**
 * Os schemas do Audesp identificam cada nó com `$id: "#root/..."` e fazem `$ref`
 * para esse identificador (é uma âncora, não um JSON Pointer). Este índice
 * resolve as referências pela âncora; ponteiros reais ("#/$defs/x") continuam
 * funcionando pelo caminho normal.
 */
function indexarAncoras(node, mapa) {
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node)) {
    for (const item of node) indexarAncoras(item, mapa);
    return;
  }
  if (typeof node.$id === 'string' && node.$id.startsWith('#')) {
    if (!mapa.has(node.$id)) mapa.set(node.$id, node);
  }
  for (const valor of Object.values(node)) {
    if (valor && typeof valor === 'object') indexarAncoras(valor, mapa);
  }
}

/** Resolve um ponteiro/âncora interno do documento. */
export function pointerTarget(doc, ref) {
  if (typeof ref !== 'string' || !ref.startsWith('#')) return null;
  // 1) âncora declarada em algum $id do documento (padrão do Audesp)
  if (doc.anchors && doc.anchors.has(ref)) return doc.anchors.get(ref);
  // 2) JSON Pointer de verdade
  let p = ref.slice(1);
  if (p === '' || p === '/') return doc.raw;
  if (p === 'root') return doc.raw;
  if (p.startsWith('root/')) p = '/' + p.slice('root/'.length);
  const parts = p.split('/').slice(1).map((s) => s.replace(/~1/g, '/').replace(/~0/g, '~'));
  let cur = doc.raw;
  for (const part of parts) {
    if (cur === null || cur === undefined) return null;
    cur = cur[part];
  }
  return cur ?? null;
}

/** Segue $ref até o nó real (com proteção contra ciclos). */
export function resolve(doc, node, seen = 0) {
  if (!node || typeof node !== 'object') return null;
  if (typeof node.$ref === 'string' && seen < 20) {
    const target = pointerTarget(doc, node.$ref);
    if (target && target !== node) return resolve(doc, target, seen + 1);
    return node;
  }
  return node;
}

/** Tipo efetivo do nó. */
export function nodeType(doc, node) {
  const n = resolve(doc, node);
  if (!n) return 'string';
  if (n.type) return Array.isArray(n.type) ? n.type[0] : n.type;
  if (n.properties) return 'object';
  if (n.items) return 'array';
  if (n.enum) return typeof n.enum[0] === 'number' ? 'number' : 'string';
  return 'string';
}

/** Nó de schema correspondente a um caminho de dados. */
export function nodeAt(doc, path) {
  let node = resolve(doc, doc.raw);
  for (const step of path) {
    if (!node) return null;
    node = resolve(doc, typeof step === 'number' ? node.items : (node.properties || {})[step]);
  }
  return node;
}

/** Título legível de um nó, com fallback para a chave. */
export function titleOf(doc, node, key) {
  const n = resolve(doc, node);
  const t = n && typeof n.title === 'string' ? n.title.trim() : '';
  if (!t || t === 'Items' || t === 'Item') return key ? humanTitle(key) : t;
  return t;
}

function humanTitle(key) {
  const s = String(key).replace(/_/g, ' ').trim();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Opções de um enum, com rótulos oficiais extraídos de examples ("1=Diário Oficial"). */
export function enumOptions(doc, node) {
  const n = resolve(doc, node) || {};
  const values = Array.isArray(n.enum) ? n.enum : [];
  const labels = new Map();
  for (const ex of n.examples || []) {
    if (typeof ex !== 'string') continue;
    const m = /^\s*(-?\d+)\s*[=\-–:]\s*(.+?)\s*$/.exec(ex);
    if (m) labels.set(Number(m[1]), m[2]);
  }
  const monthish = /m[êe]s/i.test(n.title || '');
  return values.map((v) => {
    if (typeof v === 'number') {
      let lab = labels.get(v);
      if (!lab && monthish && v >= 1 && v <= 12) lab = MONTHS[v - 1];
      return { value: v, label: lab ? `${v} — ${lab}` : String(v) };
    }
    return { value: v, label: String(v) };
  });
}

/** Texto de ajuda curto derivado do schema. */
export function hintsOf(doc, node) {
  const n = resolve(doc, node) || {};
  const hints = [];
  if (n.pattern) {
    const p = n.pattern;
    const m = /^\^\[0-9\]\{(\d+)\}$/.exec(p);
    const m2 = /^\^\[0-9\]\{(\d+),(\d+)\}$/.exec(p);
    if (m) hints.push(`${m[1]} dígitos`);
    else if (m2) hints.push(`${m2[1]} a ${m2[2]} dígitos`);
    else if (p === '^[0-9]+$') hints.push('somente números');
    else if (p === '\\S') hints.push('obrigatório (não pode ficar em branco)');
    else hints.push('respeite o formato exigido');
  }
  if (n.format === 'date') hints.push('data no formato AAAA-MM-DD');
  if (n.format === 'uri') hints.push('endereço iniciado por http:// ou https://');
  if (n.multipleOf && n.multipleOf < 1) hints.push(`${String(n.multipleOf).replace('.', ',')} em ${String(n.multipleOf).replace('.', ',')}`);
  if (typeof n.minimum === 'number' && typeof n.maximum === 'number' && n.minimum !== 0) {
    hints.push(`entre ${n.minimum} e ${n.maximum}`);
  }
  if (typeof n.maxLength === 'number' && n.maxLength >= 100) hints.push(`até ${n.maxLength} caracteres`);
  return hints;
}

/** Exemplo do schema, quando existe. */
export function exampleOf(doc, node) {
  const n = resolve(doc, node) || {};
  const ex = (n.examples || []).find((e) => typeof e !== 'object' && !/^\d+\s*[=\-–]/.test(String(e)));
  return ex === undefined ? null : ex;
}
