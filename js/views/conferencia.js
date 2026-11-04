/**
 * conferencia.js — visão de conferência: totais, cruzamentos e pendências.
 */

import { el, fmtMoney, fmtNumber, fmtDateBR } from '../util.js';
import { stats } from '../validator.js';
import { titleOf, resolve } from '../schema.js';

const num = (v) => (typeof v === 'number' && isFinite(v) ? v : 0);

function somar(lista, campo) {
  return (Array.isArray(lista) ? lista : []).reduce((acc, item) => acc + num(item && item[campo]), 0);
}

function tabela(titulo, linhas, { total = true } = {}) {
  const t = el('table', { class: 'tabela' },
    el('thead', {}, el('tr', {}, el('th', {}, titulo), el('th', { class: 'num' }, 'Valor (R$)'))),
  );
  const tbody = el('tbody');
  for (const [rotulo, valor, nota] of linhas) {
    tbody.append(el('tr', {},
      el('td', {}, rotulo, nota ? el('span', { class: 'mini' }, ` · ${nota}`) : null),
      el('td', { class: 'num' }, fmtMoney(valor)),
    ));
  }
  if (total) {
    const soma = linhas.reduce((a, l) => a + num(l[1]), 0);
    tbody.append(el('tr', { class: 'total-linha' }, el('td', {}, 'Total'), el('td', { class: 'num' }, fmtMoney(soma))));
  }
  t.append(tbody);
  return t;
}

function contar(dados, chave) {
  const v = dados ? dados[chave] : undefined;
  return Array.isArray(v) ? v.length : 0;
}

/** Alertas de cruzamento entre listas. */
function cruzamentos(dados) {
  const alertas = [];
  const d = dados || {};

  const docs = (d.documentos_fiscais || []).map((x) => ({
    numero: String(x?.numero ?? ''),
    credor: x?.credor?.documento_numero ? String(x.credor.documento_numero) : '',
    descricao: x?.descricao || '',
  }));
  const numerosDocs = new Set(docs.map((x) => x.numero).filter(Boolean));

  const repeticoes = new Map();
  for (const doc of docs) if (doc.numero) repeticoes.set(doc.numero, (repeticoes.get(doc.numero) || 0) + 1);
  const duplicados = [...repeticoes.entries()].filter(([, n]) => n > 1);
  if (duplicados.length) {
    alertas.push({
      nivel: 'alerta',
      texto: `${duplicados.length} documento(s) fiscal(is) repetido(s): ${duplicados.slice(0, 5).map(([n]) => n).join(', ')}.`,
    });
  }

  const pagamentos = d.pagamentos || [];
  const semDoc = pagamentos.filter((p) => p?.identificacao_documento_fiscal?.numero && !numerosDocs.has(String(p.identificacao_documento_fiscal.numero)));
  if (semDoc.length) {
    alertas.push({
      nivel: 'alerta',
      texto: `${semDoc.length} pagamento(s) referenciam documento fiscal não incluído na relação (ex.: ${semDoc.slice(0, 3).map((p) => p.identificacao_documento_fiscal.numero).join(', ')}).`,
    });
  }

  const contratos = new Set((d.contratos || []).map((c) => String(c?.numero ?? '')).filter(Boolean));
  const docsSemContrato = (d.documentos_fiscais || []).filter((x) => x?.identificacao_contrato?.numero && !contratos.has(String(x.identificacao_contrato.numero)));
  if (contratos.size && docsSemContrato.length) {
    alertas.push({
      nivel: 'alerta',
      texto: `${docsSemContrato.length} documento(s) fiscal(is) citam contrato não relacionado em “Contratos”.`,
    });
  }

  const empenhos = new Set((d.empenhos || []).map((e) => `${e?.numero ?? ''}|${e?.data_emissao ?? ''}`));
  const repassesSemEmpenho = (d.repasses || []).filter((r) => {
    const id = r?.identificacao_empenho;
    if (!id?.numero) return false;
    return !empenhos.has(`${id.numero}|${id.data_emissao ?? ''}`);
  });
  if (empenhos.size && repassesSemEmpenho.length) {
    alertas.push({
      nivel: 'alerta',
      texto: `${repassesSemEmpenho.length} repasse(s) citam empenho não relacionado em “Empenhos”.`,
    });
  }

  const glosasSemDoc = (d.glosas || []).filter((g) => g?.identificacao_documento_fiscal?.numero && !numerosDocs.has(String(g.identificacao_documento_fiscal.numero)));
  if (glosasSemDoc.length) {
    alertas.push({
      nivel: 'alerta',
      texto: `${glosasSemDoc.length} glosa(s) citam documento fiscal não incluído na relação.`,
    });
  }

  const semCpf = (d.relacao_empregados || []).filter((e) => !e?.cpf);
  if (semCpf.length) alertas.push({ nivel: 'erro', texto: `${semCpf.length} empregado(s) sem CPF informado.` });

  const periodosInvalidos = (d.relacao_empregados || []).filter((e) => Array.isArray(e?.periodos_remuneracao) && e.periodos_remuneracao.some((p) => num(p?.mes) < 1 || num(p?.mes) > 12));
  if (periodosInvalidos.length) alertas.push({ nivel: 'erro', texto: `${periodosInvalidos.length} empregado(s) com mês de remuneração fora de 1–12.` });

  if (!alertas.length) alertas.push({ nivel: 'ok', texto: 'Nenhuma inconsistência encontrada nos cruzamentos verificados.' });
  return alertas;
}

export function renderConferencia(doc, dados, { onJump } = {}) {
  const d = dados || {};
  const st = stats(doc, d);
  const wrap = el('div', { class: 'conferencia' });

  /* resumo */
  const descritor = d.descritor || {};
  const resumo = el('div', { class: 'painel' },
    el('h3', {}, 'Resumo do documento'),
    el('dl', { class: 'kv' },
      el('dt', {}, 'Tipo do documento'), el('dd', {}, descritor.tipo_documento || '—'),
      el('dt', {}, 'Município / Entidade'), el('dd', {}, `${descritor.municipio ?? '—'} / ${descritor.entidade ?? '—'}`),
      el('dt', {}, 'Referência'), el('dd', {}, descritor.mes ? `${String(descritor.mes).padStart(2, '0')}/${descritor.ano ?? '—'}` : '—'),
      el('dt', {}, 'Código do ajuste'), el('dd', {}, d.codigo_ajuste || '—'),
      el('dt', {}, 'Retificação'), el('dd', {}, d.retificacao === true ? 'Sim' : d.retificacao === false ? 'Não' : '—'),
      el('dt', {}, 'Preenchimento obrigatório'), el('dd', {}, `${st.filled} de ${st.req} campos (${st.pct}%)`),
    ),
  );
  wrap.append(resumo);

  /* movimentação financeira */
  const linhasEntradas = [
    ['Repasses recebidos (Receitas)', somar(d.receitas?.repasses_recebidos, 'valor')],
    ['Outras receitas', somar(d.receitas?.outras_receitas, 'valor')],
    ['Recursos próprios', somar(d.receitas?.recursos_proprios, 'valor')],
    ['Aplicações financeiras — repasses municipais', num(d.receitas?.receitas_aplic_financ_repasses_publicos_municipais)],
    ['Aplicações financeiras — repasses estaduais', num(d.receitas?.receitas_aplic_financ_repasses_publicos_estaduais)],
    ['Aplicações financeiras — repasses federais', num(d.receitas?.receitas_aplic_financ_repasses_publicos_federais)],
  ].filter(([, v]) => v);

  const linhasSaidas = [
    ['Pagamentos', somar(d.pagamentos, 'pagamento_valor')],
    ['Descontos', somar(d.descontos, 'valor')],
    ['Devoluções', somar(d.devolucoes, 'valor')],
    ['Glosas', somar(d.glosas, 'valor_glosa')],
  ].filter(([, v]) => v);

  const repasses = somar(d.repasses, 'valor_repasse');
  const saldoBancario = somar(d.disponibilidades?.saldos, 'saldo_bancario');
  const saldoContabil = somar(d.disponibilidades?.saldos, 'saldo_contabil');

  if (linhasEntradas.length || linhasSaidas.length || repasses || saldoBancario || saldoContabil) {
    wrap.append(el('div', { class: 'painel' },
      el('h3', {}, 'Movimentação financeira'),
      el('div', { style: 'display:grid;gap:16px;grid-template-columns:repeat(auto-fit,minmax(300px,1fr))' },
        linhasEntradas.length ? tabela('Entradas informadas', linhasEntradas) : el('div', { class: 'vazio' }, 'Sem receitas informadas.'),
        linhasSaidas.length ? tabela('Saídas informadas', linhasSaidas) : el('div', { class: 'vazio' }, 'Sem pagamentos informados.'),
      ),
      el('dl', { class: 'kv', style: 'margin-top:16px' },
        el('dt', {}, 'Repasses (lista “Repasses”)'), el('dd', {}, fmtMoney(repasses)),
        el('dt', {}, 'Saldos bancários'), el('dd', {}, fmtMoney(saldoBancario)),
        el('dt', {}, 'Saldos contábeis'), el('dd', {}, fmtMoney(saldoContabil)),
        el('dt', {}, 'Fundo fixo'), el('dd', {}, fmtMoney(num(d.disponibilidades?.saldo_fundo_fixo))),
        el('dt', {}, 'Diferença repasses − pagamentos'), el('dd', {}, fmtMoney(repasses - somar(d.pagamentos, 'pagamento_valor'))),
      ),
      el('p', { class: 'dica', style: 'margin:10px 0 0' },
        'Os totais acima são apenas conferência de consistência. O Audesp aplica as suas próprias regras de fechamento.'),
    ));
  }

  /* quantidades */
  const qtds = [
    ['Empregados', contar(d, 'relacao_empregados')],
    ['Servidores cedidos', contar(d, 'servidores_cedidos')],
    ['Contratos', contar(d, 'contratos')],
    ['Documentos fiscais', contar(d, 'documentos_fiscais')],
    ['Pagamentos', contar(d, 'pagamentos')],
    ['Empenhos', contar(d, 'empenhos')],
    ['Repasses', contar(d, 'repasses')],
    ['Glosas', contar(d, 'glosas')],
    ['Publicações de parecer/ata', contar(d, 'publicacoes_parecer_ata')],
  ];
  wrap.append(el('div', { class: 'painel' },
    el('h3', {}, 'Itens lançados'),
    el('div', { style: 'display:grid;gap:8px;grid-template-columns:repeat(auto-fit,minmax(150px,1fr))' },
      qtds.map(([rotulo, qtd]) => el('div', {},
        el('div', { class: 'mini' }, rotulo),
        el('div', { style: 'font-size:20px;font-weight:700;font-variant-numeric:tabular-nums' }, String(qtd)),
      ))),
  ));

  /* cruzamentos */
  wrap.append(el('div', { class: 'painel' },
    el('h3', {}, 'Cruzamentos verificados'),
    el('ul', { class: 'lista-erros' },
      cruzamentos(d).map((a) => el('li', {},
        el('span', { class: `chip ${a.nivel === 'ok' ? 'ok' : a.nivel === 'erro' ? 'erro' : 'alerta'}`, style: 'margin-right:6px' },
          a.nivel === 'ok' ? 'OK' : a.nivel === 'erro' ? 'Erro' : 'Atenção'),
        a.texto)),
    ),
  ));

  /* pendências por seção */
  const pendentes = doc.sectionKeys
    .map((key) => ({ key, ...st.sections[key] }))
    .filter((s) => s.req > 0 && s.filled < s.req)
    .sort((a, b) => (b.req - b.filled) - (a.req - a.filled));

  const painelPend = el('div', { class: 'painel' }, el('h3', {}, 'Seções incompletas'));
  if (!pendentes.length) {
    painelPend.append(el('p', { class: 'dica' }, 'Todos os campos obrigatórios estão preenchidos.'));
  } else {
    painelPend.append(el('p', { class: 'dica' }, 'Clique em uma seção para ir direto ao formulário.'));
    const lista = el('div', { style: 'display:flex;flex-direction:column;gap:6px' });
    for (const s of pendentes) {
      const node = resolve(doc, (doc.raw.properties || {})[s.key]);
      lista.append(el('button', {
        class: 'btn btn-ghost', type: 'button', style: 'justify-content:space-between',
        onclick: () => onJump && onJump(s.key),
      },
        el('span', {}, titleOf(doc, node, s.key)),
        el('span', { class: 'chip alerta' }, `${s.filled}/${s.req}`),
      ));
    }
    painelPend.append(lista);
  }
  wrap.append(painelPend);

  wrap.append(el('div', { style: 'display:flex;gap:8px;margin-top:6px' },
    el('button', { class: 'btn', type: 'button', onclick: () => window.print() }, '🖨 Imprimir esta conferência'),
  ));

  return wrap;
}
