/**
 * home.js — lista de prestações de contas, criação, importação e backup.
 */

import { listRecords, saveRecord, deleteRecord, importRecords, getPrefs, setPrefs } from '../store.js';
import { TIPOS, ORDEM_TIPOS, arquivoExemplo } from '../schema.js';
import { validate, stats } from '../validator.js';
import { el, fmtDateTimeBR, uid, clone, download, todayISO } from '../util.js';
import { toast, openModal, confirmDialog, pageHeader } from '../ui/shell.js';
import { baixarRegistro, tipoPorDocumento } from '../exportar.js';

const INSTRUMENTOS = ['termo_colaboracao', 'termo_fomento', 'termo_parceria', 'convenio', 'contrato_gestao'];

function avaliar(rec, doc) {
  if (!doc) return { rotulo: 'Schema ausente', classe: 'erro', pct: 0, erros: 0 };
  const erros = validate(doc, rec.dados || {});
  const st = stats(doc, rec.dados || {});
  if (!st.filled) return { rotulo: 'Rascunho', classe: 'neutro', pct: 0, erros: 0 };
  if (st.pct >= 100 && !erros.length) return { rotulo: 'Completo', classe: 'ok', pct: 100, erros: 0 };
  return {
    rotulo: erros.length ? `${erros.length} pendência${erros.length === 1 ? '' : 's'}` : 'Em andamento',
    classe: 'alerta',
    pct: st.pct,
    erros: erros.length,
  };
}

export async function renderHome(root, ctx) {
  const pagina = el('div', { class: 'pagina' });
  root.replaceChildren(pagina);

  const registros = (await listRecords()).sort((a, b) => String(b.atualizado || '').localeCompare(String(a.atualizado || '')));
  const avaliados = registros.map((rec) => ({ rec, av: avaliar(rec, ctx.schemas[rec.tipo]) }));

  const total = avaliados.length;
  const completos = avaliados.filter((x) => x.av.classe === 'ok').length;
  const emCurso = avaliados.filter((x) => x.av.classe === 'alerta').length;
  const rascunhos = avaliados.filter((x) => x.av.classe === 'neutro').length;
  const atualizadoEm = registros[0] ? fmtDateTimeBR(registros[0].atualizado) : '—';

  pagina.append(pageHeader({
    title: 'Prestações de contas',
    subtitle: 'Documentos no padrão Audesp Fase V (v1.16) salvos neste navegador. Preencha, valide e gere o JSON de envio.',
    actions: [
      el('button', { class: 'btn btn-primario', type: 'button', onclick: () => modalNova(ctx) }, '＋ Nova prestação'),
      el('button', { class: 'btn', type: 'button', onclick: () => modalExemplo(ctx) }, 'Usar exemplo'),
      el('button', { class: 'btn', type: 'button', onclick: () => importarArquivo(ctx) }, 'Importar JSON'),
      el('button', { class: 'btn', type: 'button', onclick: () => backup(registros) }, 'Backup'),
    ],
  }));

  pagina.append(el('div', { class: 'stats' },
    stat('Prestações', total, total ? `última alteração em ${atualizadoEm}` : 'nenhuma ainda'),
    stat('Completas', completos, 'sem pendências'),
    stat('Em andamento', emCurso, 'com pendências'),
    stat('Rascunhos', rascunhos, 'sem dados lançados'),
  ));

  const busca = el('input', { type: 'search', placeholder: 'Buscar por município, entidade, código do ajuste…' });
  const filtroTipo = el('select', {},
    el('option', { value: '' }, 'Todos os tipos'),
    ...ORDEM_TIPOS.map((k) => el('option', { value: k }, TIPOS[k].nome)),
  );
  const anos = [...new Set(registros.map((r) => r.dados?.descritor?.ano).filter(Boolean))].sort();
  const filtroAno = el('select', {},
    el('option', { value: '' }, 'Todos os anos'),
    ...anos.map((a) => el('option', { value: String(a) }, String(a))),
  );

  const lista = el('div', { class: 'cards' });
  pagina.append(el('div', { class: 'toolbar' }, el('div', { class: 'campo-busca' }, busca), filtroTipo, filtroAno), lista);

  const pintarLista = () => {
    const termo = busca.value.trim().toLowerCase();
    const fTipo = filtroTipo.value;
    const fAno = filtroAno.value;

    const visiveis = avaliados.filter(({ rec }) => {
      if (fTipo && rec.tipo !== fTipo) return false;
      const ano = rec.dados?.descritor?.ano;
      if (fAno && String(ano) !== fAno) return false;
      if (!termo) return true;
      const alvo = [
        rec.tipo, TIPOS[rec.tipo]?.nome, rec.dados?.descritor?.municipio, rec.dados?.descritor?.entidade,
        rec.dados?.descritor?.ano, rec.dados?.descritor?.mes, rec.dados?.codigo_ajuste, rec.dados?.descritor?.tipo_documento,
      ].join(' ').toLowerCase();
      return alvo.includes(termo);
    });

    lista.replaceChildren();
    if (!visiveis.length) {
      lista.append(el('div', { class: 'vazio', style: 'grid-column:1/-1;padding:36px' },
        registros.length
          ? 'Nenhuma prestação corresponde ao filtro.'
          : 'Nenhuma prestação cadastrada. Use “Nova prestação” ou “Usar exemplo” para começar.',
      ));
      return;
    }
    for (const { rec, av } of visiveis) lista.append(card(rec, av, ctx));
  };

  busca.addEventListener('input', pintarLista);
  filtroTipo.addEventListener('change', pintarLista);
  filtroAno.addEventListener('change', pintarLista);
  pintarLista();
}

function stat(rotulo, valor, nota) {
  return el('div', { class: 'stat' },
    el('div', { class: 'stat-rotulo' }, rotulo),
    el('div', { class: 'stat-valor' }, String(valor)),
    nota ? el('div', { class: 'stat-nota' }, nota) : null,
  );
}

function card(rec, av, ctx) {
  const def = TIPOS[rec.tipo] || { nome: rec.tipo, curto: rec.tipo };
  const d = rec.dados?.descritor || {};
  const ref = d.mes && d.ano ? `${String(d.mes).padStart(2, '0')}/${d.ano}` : 'referência não informada';
  const titulo = rec.dados?.codigo_ajuste ? `Ajuste ${rec.dados.codigo_ajuste}` : 'Sem código de ajuste';
  const meta = [d.municipio ? `Município ${d.municipio}` : null, d.entidade ? `Entidade ${d.entidade}` : null, ref].filter(Boolean);

  return el('article', { class: 'card' },
    el('div', { class: 'card-topo' },
      el('span', { class: 'chip' }, def.curto || def.nome),
      el('span', { class: `chip ${av.classe}` }, av.rotulo),
    ),
    el('div', { class: 'card-titulo' }, titulo),
    el('div', { class: 'card-meta' }, ...meta.map((m) => el('span', {}, m))),
    el('div', { class: 'progresso' },
      el('div', { class: `barra ${av.pct >= 100 ? 'completa' : ''}` }, el('i', { style: `width:${av.pct}%` })),
      el('small', {}, `${av.pct}%`),
    ),
    el('div', { class: 'card-meta' },
      el('span', {}, `Atualizado ${fmtDateTimeBR(rec.atualizado)}`),
    ),
    el('div', { class: 'card-acoes' },
      el('button', { class: 'btn btn-primario btn-mini', type: 'button', onclick: () => ctx.navigate(`#/edit/${rec.id}`) }, 'Abrir'),
      el('button', { class: 'btn btn-mini', type: 'button', onclick: () => { baixarRegistro(rec); toast('JSON gerado', 'ok'); } }, '⤓ JSON'),
      el('button', { class: 'btn btn-mini', type: 'button', onclick: () => duplicar(rec, ctx) }, '⧉ Duplicar'),
      el('button', { class: 'btn btn-ghost btn-mini perigo', type: 'button', onclick: () => excluir(rec, ctx) }, 'Excluir'),
    ),
  );
}

async function duplicar(rec, ctx) {
  const copia = clone(rec);
  copia.id = uid();
  copia.criado = new Date().toISOString();
  copia.titulo = `${rec.titulo || ''} (cópia)`.trim();
  await saveRecord(copia);
  toast('Prestação duplicada', 'ok');
  ctx.navigate(`#/edit/${copia.id}`);
}

async function excluir(rec, ctx) {
  const ok = await confirmDialog({
    title: 'Excluir prestação',
    message: 'Esta ação remove o documento deste navegador. Se precisar guardar, baixe o JSON antes.',
    confirmLabel: 'Excluir',
    danger: true,
  });
  if (!ok) return;
  await deleteRecord(rec.id);
  toast('Prestação excluída');
  ctx.refresh();
}

/* ------------------------------------------------------------------ nova */

export async function modalNova(ctx) {
  const prefs = getPrefs();
  const hoje = new Date();
  const selTipo = el('select', { class: 'largo' }, ...ORDEM_TIPOS.map((k) => el('option', { value: k }, TIPOS[k].nome)));
  if (prefs.ultimoTipo && TIPOS[prefs.ultimoTipo]) selTipo.value = prefs.ultimoTipo;

  const selInstr = el('select', {}, ...INSTRUMENTOS.map((k) => el('option', { value: k }, TIPOS[k].nome)));
  const linhaInstr = el('label', { class: 'largo' }, 'Instrumento declarado', selInstr,
    el('span', { class: 'mini' }, 'A Declaração Negativa é feita por tipo de documento.'));
  linhaInstr.hidden = selTipo.value !== 'declaracao_negativa';

  const municipio = el('input', { type: 'text', inputmode: 'numeric', maxLength: 4, value: prefs.municipio || '' });
  const entidade = el('input', { type: 'text', inputmode: 'numeric', maxLength: 5, value: prefs.entidade || '' });
  const ano = el('input', { type: 'number', min: 2024, max: 2100, value: String(hoje.getFullYear()) });
  const mes = el('input', { type: 'number', min: 1, max: 12, value: '12' });
  const codigo = el('input', { type: 'text', inputmode: 'numeric', maxLength: 19, placeholder: '15 a 19 dígitos' });

  const conteudo = el('div', { class: 'form-modal' },
    el('label', { class: 'largo' }, 'Tipo de documento', selTipo),
    linhaInstr,
    el('label', {}, 'Código do município', municipio),
    el('label', {}, 'Código da entidade', entidade),
    el('label', {}, 'Ano da prestação', ano),
    el('label', {}, 'Mês (fechamento)', mes),
    el('label', { class: 'largo' }, 'Código do ajuste (opcional agora)', codigo),
    el('p', { class: 'mini largo' }, 'O código do ajuste segue o padrão do Audesp: 15 a 19 dígitos numéricos.'),
  );

  selTipo.addEventListener('change', () => { linhaInstr.hidden = selTipo.value !== 'declaracao_negativa'; });

  const resposta = await openModal({
    title: 'Nova prestação de contas',
    content: conteudo,
    wide: true,
    actions: [
      { label: 'Cancelar', value: null },
      { label: 'Criar e preencher', value: 'criar', kind: 'btn-primario' },
    ],
  });
  if (resposta !== 'criar') return;

  const mun = Number(municipio.value.replace(/\D+/g, ''));
  const ent = Number(entidade.value.replace(/\D+/g, ''));
  const anoNum = Number(ano.value);
  const mesNum = Number(mes.value);
  const cod = codigo.value.replace(/\D+/g, '');

  if (!mun || !ent) { toast('Informe os códigos de município e entidade.', 'erro'); return; }
  if (!anoNum || anoNum < 2024) { toast('Ano deve ser 2024 ou posterior.', 'erro'); return; }
  if (mesNum !== 12) { toast('O mês de fechamento é 12 (dezembro).', 'erro'); return; }
  if (cod && (cod.length < 15 || cod.length > 19)) { toast('Código do ajuste deve ter 15 a 19 dígitos.', 'erro'); return; }

  const tipo = selTipo.value;
  const instrumento = tipo === 'declaracao_negativa' ? selInstr.value : tipo;
  const dados = {
    descritor: {
      tipo_documento: `Prestação de Contas de ${TIPOS[instrumento].nome}`,
      municipio: mun,
      entidade: ent,
      ano: anoNum,
      mes: 12,
    },
  };
  if (cod) dados.codigo_ajuste = cod;

  const rec = {
    id: uid(),
    tipo,
    criado: new Date().toISOString(),
    atualizado: new Date().toISOString(),
    versaoSchema: 'v1.16',
    dados,
  };
  await saveRecord(rec);
  setPrefs({ municipio: String(mun), entidade: String(ent), ultimoTipo: tipo });
  toast('Prestação criada. Comece pela seção Identificação.', 'ok');
  ctx.navigate(`#/edit/${rec.id}`);
}

/* ------------------------------------------------------------------ exemplo */

export async function modalExemplo(ctx) {
  const sel = el('select', { class: 'largo' }, ...INSTRUMENTOS.concat('declaracao_negativa').map((k) => el('option', { value: k }, TIPOS[k].nome)));
  const conteudo = el('div', { class: 'form-modal' },
    el('label', { class: 'largo' }, 'Documento de exemplo', sel),
    el('p', { class: 'mini largo' },
      'Carrega o arquivo de exemplo oficial (v1.16) como um novo registro editável. Útil para explorar o sistema.'),
  );
  const resposta = await openModal({
    title: 'Usar documento de exemplo',
    content: conteudo,
    actions: [{ label: 'Cancelar', value: null }, { label: 'Carregar', value: 'ok', kind: 'btn-primario' }],
  });
  if (resposta !== 'ok') return;

  const tipo = sel.value;
  try {
    const res = await fetch(`dados/${arquivoExemplo(tipo)}`, { cache: 'no-cache' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const dados = await res.json();
    const rec = {
      id: uid(), tipo, criado: new Date().toISOString(), atualizado: new Date().toISOString(),
      versaoSchema: 'v1.16', dados,
    };
    await saveRecord(rec);
    toast('Exemplo carregado.', 'ok');
    ctx.navigate(`#/edit/${rec.id}`);
  } catch (err) {
    toast(`Não foi possível carregar o exemplo: ${err.message}`, 'erro');
  }
}

/* ------------------------------------------------------------------ importar */

export function importarArquivo(ctx) {
  const input = el('input', { type: 'file', accept: '.json,application/json', style: 'display:none' });
  document.body.append(input);
  input.addEventListener('change', async () => {
    const file = input.files && input.files[0];
    input.remove();
    if (!file) return;
    let json;
    try {
      json = JSON.parse(await file.text());
    } catch (err) {
      toast('Arquivo não é um JSON válido.', 'erro');
      return;
    }
    const registros = extrairRegistros(json);
    if (!registros.length) {
      toast('Nenhuma prestação reconhecida no arquivo.', 'erro');
      return;
    }
    const n = await importRecords(registros);
    toast(`${n} prestação(ões) importada(s).`, 'ok');
    ctx.refresh();
  });
  input.click();
}

export function extrairRegistros(json) {
  const agora = new Date().toISOString();
  const arr = Array.isArray(json) ? json : (json && Array.isArray(json.registros) ? json.registros : null);
  if (arr) return arr.filter((r) => r && r.tipo && r.dados);

  if (json && json.dados && json.tipo) return [json];

  if (json && json.descritor) {
    const tipo = tipoPorDocumento(json.descritor.tipo_documento);
    if (!tipo) return [];
    return [{
      id: uid(), tipo, criado: agora, atualizado: agora, versaoSchema: 'v1.16', dados: json,
    }];
  }
  return [];
}

/* ------------------------------------------------------------------ backup */

export function backup(registros) {
  const pacote = {
    app: 'audesp-pc',
    versao: 1,
    exportado: new Date().toISOString(),
    registros,
  };
  download(`audesp-pc-backup-${todayISO()}.json`, JSON.stringify(pacote, null, 2));
  toast('Backup gerado.', 'ok');
}
