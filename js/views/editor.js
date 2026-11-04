/**
 * editor.js — tela de edição de uma prestação de contas.
 */

import { getRecord, saveRecord, deleteRecord, salvarSnapshot, listarHistorico } from '../store.js';
import { TIPOS, resolve, titleOf } from '../schema.js';
import { validate, stats, errorIndex } from '../validator.js';
import { Form } from '../ui/form.js';
import { el, debounce, clone, uid, fmtDateTimeBR } from '../util.js';
import { toast, confirmDialog, openModal } from '../ui/shell.js';
import { baixarRegistro, serializar, nomeArquivo } from '../exportar.js';
import {
  suportaArquivoLocal, vincularArquivo, desvincularArquivo, arquivoVinculado, nomeDoArquivoVinculado, salvarNoArquivo,
} from '../persistencia.js';
import { renderConferencia } from './conferencia.js';

export async function renderEditor(root, ctx, id, abaInicial) {
  const rec = await getRecord(id);
  if (!rec) {
    toast('Prestação não encontrada.', 'erro');
    ctx.navigate('#/');
    return;
  }
  if (!rec.dados) rec.dados = {};
  const doc = ctx.schemas[rec.tipo];
  if (!doc) {
    root.replaceChildren(el('div', { class: 'pagina' }, el('div', { class: 'aviso erro' },
      `O schema do tipo “${rec.tipo}” não foi carregado. Verifique a pasta dados/.`)));
    return;
  }

  let forcarErros = false;

  /* ------------------------------------------------------------- cabeçalho */
  const titulo = el('h1', {}, TIPOS[rec.tipo].nome);
  const sub = el('div', { class: 'editor-sub' });
  const chip = el('span', { class: 'chip neutro' }, 'Rascunho');
  const barra = el('div', { class: 'barra' }, el('i', { style: 'width:0%' }));
  const barraFill = barra.firstChild;
  const pct = el('small', {}, '0%');

  const statusSalvo = el('div', { class: 'status-salvo' }, el('span', { class: 'ponto' }), el('span', {}, 'salvo'));
  const textoSalvo = statusSalvo.lastChild;

  const voltar = el('button', { class: 'btn btn-ghost', type: 'button', onclick: () => ctx.navigate('#/'), 'aria-label': 'Voltar' }, '←');

  const btnValidar = el('button', { class: 'btn', type: 'button', onclick: () => validarTudo() }, '✓ Validar');
  const btnBaixar = el('button', { class: 'btn btn-primario', type: 'button', onclick: () => exportar() }, '⤓ Baixar JSON');
  const btnMais = el('button', { class: 'btn btn-ghost', type: 'button', title: 'Mais ações', onclick: () => menuMais() }, '⋯');

  const topo = el('header', { class: 'editor-topo' },
    voltar,
    el('div', { style: 'min-width:0;flex:1' },
      titulo,
      sub,
      el('div', { style: 'display:flex;align-items:center;gap:12px;margin-top:7px;flex-wrap:wrap' },
        chip,
        el('div', { class: 'progresso', style: 'width:230px' }, barra, pct),
      ),
    ),
    el('div', { class: 'editor-acoes' }, statusSalvo, btnValidar, btnBaixar, btnMais),
  );

  /* ----------------------------------------------------------------- abas */
  const abas = [
    { id: 'form', rotulo: 'Formulário' },
    { id: 'conf', rotulo: 'Conferência' },
    { id: 'json', rotulo: 'JSON' },
  ];
  const tabsBar = el('div', { class: 'tabs', role: 'tablist' });
  const painelForm = el('div', { role: 'tabpanel' });
  const painelConf = el('div', { role: 'tabpanel', hidden: true });
  const painelJson = el('div', { role: 'tabpanel', hidden: true });
  const resumo = el('div', { class: 'painel', hidden: true });

  const botoesAba = new Map();
  for (const a of abas) {
    const b = el('button', { class: 'tab', type: 'button', role: 'tab', 'aria-selected': a.id === 'form' ? 'true' : 'false', onclick: () => mostrarAba(a.id) }, a.rotulo);
    botoesAba.set(a.id, b);
    tabsBar.append(b);
  }

  /* ------------------------------------------------------------- formulário */
  const form = new Form({ doc, data: rec.dados, onChange: () => agendar() });
  painelForm.append(form.render());

  /* ------------------------------------------------------------------ nav */
  const nav = el('aside', { class: 'nav-secoes' });
  const navItens = new Map();
  for (const grupo of doc.grupos) {
    const g = el('div', { class: 'nav-grupo' }, el('div', { class: 'nav-grupo-titulo' }, grupo.titulo));
    for (const key of grupo.chaves) {
      const node = resolve(doc, (doc.raw.properties || {})[key]);
      const dot = el('span', { class: 'nav-dot' });
      const rotuloSecao = titleOf(doc, node, key);
      const item = el('button', {
        class: 'nav-item', type: 'button', dataset: { nav: key },
        title: rotuloSecao,
        onclick: () => { mostrarAba('form'); form.goToSection(key); },
      }, el('span', { class: 'nav-nome' }, rotuloSecao), dot);
      navItens.set(key, { item, dot });
      g.append(item);
    }
    nav.append(g);
  }

  const area = el('div', { class: 'area' }, resumo, tabsBar, painelForm, painelConf, painelJson);
  const pagina = el('div', { class: 'editor' }, topo, el('div', { class: 'editor-corpo' }, nav, area));
  root.replaceChildren(pagina);

  /* ------------------------------------------------------------------ lógica */

  const aplicar = () => {
    const erros = validate(doc, rec.dados);
    const idx = errorIndex(erros);
    const st = stats(doc, rec.dados);
    form.paint(idx.byPath, forcarErros);
    form.refresh(st);
    pintarCabecalho(st, erros);
    pintarNav(idx.bySection);
    if (abaAtual === 'conf' && !painelConf.hidden) montarConferencia();
    if (abaAtual === 'json' && !painelJson.hidden) montarJson();
  };

  const recalcular = debounce(aplicar, 220);

  let ultimoSnapshot = Date.now();
  let arquivoNome = null;
  let avisouArquivo = false;

  const salvar = debounce(async () => {
    const salvo = await saveRecord(rec);
    rec.atualizado = salvo.atualizado;

    // versão de segurança a cada 2 minutos de edição
    if (Date.now() - ultimoSnapshot > 120000) {
      ultimoSnapshot = Date.now();
      salvarSnapshot(rec.id, rec.dados).catch(() => {});
    }

    // espelho em arquivo local, quando vinculado
    if (arquivoNome) {
      try {
        await salvarNoArquivo(rec);
      } catch (err) {
        if (!avisouArquivo) {
          avisouArquivo = true;
          toast(`Não gravou em ${arquivoNome}: ${err.message}`, 'erro', 7000);
        }
      }
    }

    statusSalvo.classList.remove('salvando');
    textoSalvo.textContent = `salvo às ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
  }, 900);

  function agendar() {
    statusSalvo.classList.add('salvando');
    textoSalvo.textContent = 'salvando…';
    recalcular();
    salvar();
  }

  async function atualizarIndicadorArquivo() {
    const handle = await arquivoVinculado();
    arquivoNome = handle ? nomeDoArquivoVinculado(handle) : null;
    if (arquivoNome) {
      statusSalvo.title = `Gravando também em ${arquivoNome}`;
      textoSalvo.textContent = `salvo · ${arquivoNome}`;
    } else {
      statusSalvo.title = 'Salvo neste navegador';
    }
  }

  let abaAtual = 'form';

  function mostrarAba(aba) {
    abaAtual = aba;
    for (const a of abas) {
      botoesAba.get(a.id).setAttribute('aria-selected', a.id === aba ? 'true' : 'false');
    }
    painelForm.hidden = aba !== 'form';
    painelConf.hidden = aba !== 'conf';
    painelJson.hidden = aba !== 'json';
    if (aba !== 'form') resumo.hidden = true;
    if (aba === 'conf') montarConferencia();
    if (aba === 'json') montarJson();
    const sufixo = aba === 'form' ? '' : `?aba=${aba}`;
    history.replaceState(null, '', `#/edit/${rec.id}${sufixo}`);
  }

  function montarConferencia() {
    painelConf.replaceChildren(renderConferencia(doc, rec.dados, {
      onJump: (sec) => { mostrarAba('form'); form.goToSection(sec); },
    }));
  }

  function montarJson() {
    const erros = validate(doc, rec.dados);
    const aviso = el('div', { class: `aviso ${erros.length ? 'erro' : ''}` },
      erros.length
        ? `Este documento tem ${erros.length} pendência(s) segundo o schema. O JSON pode ser baixado, mas provavelmente será rejeitado no Audesp.`
        : 'Documento válido segundo o schema: nada impede o envio no que depende do leiaute.',
    );
    const pre = el('pre', { class: 'json-view' }, serializar(rec));
    painelJson.replaceChildren(
      el('div', { style: 'display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:10px' },
        el('strong', { style: 'font-size:13.5px' }, `Arquivo: ${nomeArquivo(rec)}`),
        el('button', { class: 'btn btn-mini', type: 'button', onclick: () => copiarJson() }, '⧉ Copiar'),
        el('button', { class: 'btn btn-mini', type: 'button', onclick: () => baixarRegistro(rec) }, '⤓ Baixar'),
      ),
      aviso,
      pre,
    );
  }

  async function copiarJson() {
    try {
      await navigator.clipboard.writeText(serializar(rec));
      toast('JSON copiado.', 'ok');
    } catch {
      toast('Não foi possível copiar automaticamente. Use “Baixar”.', 'erro');
    }
  }

  function pintarCabecalho(st, erros) {
    const d = rec.dados.descritor || {};
    sub.replaceChildren(
      el('span', {}, d.municipio ? `Município ${d.municipio}` : 'Município não informado'),
      el('span', {}, d.entidade ? `· Entidade ${d.entidade}` : '· Entidade não informada'),
      el('span', {}, `· Ref. ${d.mes ? String(d.mes).padStart(2, '0') : '—'}/${d.ano ?? '—'}`),
      rec.dados.codigo_ajuste ? el('span', {}, `· Ajuste ${rec.dados.codigo_ajuste}`) : el('span', {}, '· sem código'),
    );
    barraFill.style.width = `${st.pct}%`;
    barra.parentElement.classList.toggle('completa', st.pct >= 100 && !erros.length);
    pct.textContent = `${st.pct}%`;
    const completo = st.pct >= 100 && !erros.length;
    chip.className = `chip ${completo ? 'ok' : erros.length ? 'alerta' : 'neutro'}`;
    chip.textContent = completo ? 'Completo' : erros.length ? `${erros.length} pendência${erros.length === 1 ? '' : 's'}` : (st.pct ? 'Em andamento' : 'Rascunho');
  }

  function pintarNav(bySection) {
    for (const [key, ref] of navItens) {
      const n = bySection.get(key) || 0;
      ref.dot.textContent = n ? String(n) : '';
      ref.dot.className = n ? 'nav-dot' : 'nav-ok';
      const sec = form.sections.get(key);
      if (sec) sec.sec.classList.toggle('invalida', n > 0 && forcarErros);
    }
  }

  function validarTudo() {
    forcarErros = true;
    const erros = validate(doc, rec.dados);
    const idx = errorIndex(erros);
    const st = stats(doc, rec.dados);
    form.paint(idx.byPath, true);
    form.refresh(st);
    pintarCabecalho(st, erros);
    pintarNav(idx.bySection);
    if (!erros.length) {
      resumo.hidden = true;
      toast('Documento válido segundo o schema.', 'ok');
      return;
    }
    resumo.hidden = false;
    const partes = [
      el('h3', {}, `${erros.length} pendência(s) encontrada(s)`),
      el('p', { class: 'dica' }, 'As seções com problema estão marcadas no menu à esquerda.'),
      el('ul', { class: 'lista-erros' },
        erros.slice(0, 12).map((e) => el('li', {},
          el('b', {}, rotuloDoCaminho(e.path)), ' — ', e.message)),
      ),
    ];
    if (erros.length > 12) partes.push(el('p', { class: 'dica' }, `… e mais ${erros.length - 12}.`));
    partes.push(el('div', { style: 'display:flex;gap:8px;margin-top:8px' },
      el('button', { class: 'btn btn-mini', type: 'button', onclick: () => form.focusFirstError() }, 'Ir para o primeiro erro'),
      el('button', { class: 'btn btn-ghost btn-mini', type: 'button', onclick: () => { resumo.hidden = true; } }, 'Fechar'),
    ));
    resumo.replaceChildren(...partes);
  }

  function rotuloDoCaminho(path) {
    const partes = [];
    let node = resolve(doc, doc.raw);
    for (const step of path) {
      if (typeof step === 'number') {
        node = resolve(doc, node.items);
        partes.push(`#${step + 1}`);
      } else {
        node = resolve(doc, (node.properties || {})[step]);
        partes.push(titleOf(doc, node, step));
      }
    }
    return partes.join(' › ');
  }

  async function exportar() {
    const erros = validate(doc, rec.dados);
    if (erros.length) {
      const ok = await confirmDialog({
        title: 'Documento com pendências',
        message: `Existem ${erros.length} pendência(s) de validação. O arquivo pode ser gerado, mas tende a ser rejeitado no Audesp. Baixar de qualquer forma?`,
        confirmLabel: 'Baixar mesmo assim',
      });
      if (!ok) return;
    }
    baixarRegistro(rec);
    toast(`Arquivo gerado: ${nomeArquivo(rec)}`, 'ok');
  }

  async function menuMais() {
    const handle = await arquivoVinculado();
    const vinculo = handle ? nomeDoArquivoVinculado(handle) : null;

    const botoes = [
      el('button', { class: 'btn', type: 'button', onclick: async () => { await abrirHistorico(); } }, '🕘 Histórico de versões'),
    ];

    if (suportaArquivoLocal()) {
      botoes.push(el('button', {
        class: 'btn', type: 'button',
        onclick: async () => {
          try {
            const h = await vincularArquivo(rec);
            toast(`Agora o documento é gravado em ${h.name}.`, 'ok', 6000);
            await atualizarIndicadorArquivo();
          } catch (err) {
            if (err.name !== 'AbortError') toast(err.message, 'erro', 6000);
          }
        },
      }, vinculo ? '🔗 Trocar arquivo vinculado…' : '💾 Salvar também em arquivo…'));
    }

    if (vinculo) {
      botoes.push(el('button', {
        class: 'btn btn-ghost', type: 'button',
        onclick: async () => {
          await desvincularArquivo();
          arquivoNome = null;
          await atualizarIndicadorArquivo();
          textoSalvo.textContent = 'salvo';
          toast('Arquivo desvinculado — o documento continua salvo neste navegador.');
        },
      }, `Desvincular ${vinculo}`));
    }

    botoes.push(el('button', { class: 'btn', type: 'button', onclick: async () => { await duplicar(); } }, '⧉ Duplicar prestação'));
    botoes.push(el('button', { class: 'btn btn-perigo', type: 'button', onclick: async () => { await excluir(); } }, 'Excluir prestação'));

    const conteudo = el('div', {},
      el('p', { class: 'dica' }, `Arquivo gerado: ${nomeArquivo(rec)}`),
      el('p', { class: 'dica' }, `Criado em ${fmtDateTimeBR(rec.criado)} · atualizado em ${fmtDateTimeBR(rec.atualizado)}`),
      suportaArquivoLocal()
        ? el('p', { class: 'mini' }, 'O arquivo vinculado é sobrescrito a cada alteração — escolha, por exemplo, uma pasta do Google Drive para ter cópia na nuvem.')
        : el('p', { class: 'mini' }, 'Este navegador não permite gravar direto em arquivo; use “Baixar JSON” para guardar.'),
      el('div', { style: 'display:flex;flex-direction:column;gap:8px;margin-top:12px' }, botoes),
    );
    await openModal({ title: 'Mais ações', content: conteudo });
  }

  /* ------------------------------------------------------------- histórico */

  async function abrirHistorico() {
    const versoes = await listarHistorico(rec.id);
    const corpo = el('div', {});

    if (!versoes.length) {
      corpo.append(el('p', { class: 'dica' },
        'Nenhuma versão guardada ainda. O sistema cria pontos de restauração automaticamente a cada 2 minutos de edição.'));
    } else {
      corpo.append(el('p', { class: 'dica' }, `${versoes.length} versão(ões) guardada(s). Restaurar substitui o conteúdo atual.`));
      const lista = el('div', { class: 'lista-versoes' });
      for (const v of versoes.slice(0, 12)) {
        const quando = new Date(v.quando);
        lista.append(el('div', { class: 'versao' },
          el('div', {},
            el('strong', {}, quando.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })),
            el('div', { class: 'mini' }, `${Object.keys(v.dados || {}).length} seção(ões) com dados`),
          ),
          el('button', {
            class: 'btn btn-mini', type: 'button',
            onclick: async () => {
              const ok = await confirmDialog({
                title: 'Restaurar versão',
                message: `Voltar o documento para ${quando.toLocaleString('pt-BR')}? O conteúdo atual será substituído (uma versão dele também está no histórico).`,
                confirmLabel: 'Restaurar',
              });
              if (!ok) return;
              await salvarSnapshot(rec.id, rec.dados);
              rec.dados = clone(v.dados);
              await saveRecord(rec);
              toast('Versão restaurada.', 'ok');
              ctx.navigate(`#/edit/${rec.id}`);
            },
          }, 'Restaurar'),
        ));
      }
      corpo.append(lista);
    }

    await openModal({ title: 'Histórico de versões', content: corpo, wide: true });
  }

  async function duplicar() {
    const copia = clone(rec);
    copia.id = uid();
    copia.criado = new Date().toISOString();
    await saveRecord(copia);
    toast('Prestação duplicada.', 'ok');
    ctx.navigate(`#/edit/${copia.id}`);
  }

  async function excluir() {
    const ok = await confirmDialog({
      title: 'Excluir prestação',
      message: 'O documento será removido deste navegador. Baixe o JSON antes, se quiser guardar.',
      confirmLabel: 'Excluir', danger: true,
    });
    if (!ok) return;
    await deleteRecord(rec.id);
    toast('Prestação excluída.');
    ctx.navigate('#/');
  }

  /* inicial */
  aplicar();
  atualizarIndicadorArquivo();
  if (abaInicial && ['conf', 'json'].includes(abaInicial)) mostrarAba(abaInicial);
}
