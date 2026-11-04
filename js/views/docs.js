/**
 * docs.js — aba “Documentação”: manuais oficiais em PDF e visão do leiaute.
 */

import { el } from '../util.js';
import { TIPOS, ORDEM_TIPOS, ROTULO_VERSAO } from '../schema.js';
import { stats } from '../validator.js';
import { pageHeader } from '../ui/shell.js';
import { modalNova } from './home.js';

const MANUAIS = [
  {
    titulo: 'Manual da Prestação de Contas dos Repasses ao Terceiro Setor',
    versao: 'v1.21',
    arquivo: 'docs/manual-prestacao-contas-terceiro-setor-v1.21.pdf',
    bytes: 922398,
    descricao:
      'Orienta o preenchimento da prestação de contas dos repasses ao terceiro setor: conceitos, prazos, documentos exigidos e o detalhamento de cada bloco do leiaute.',
  },
  {
    titulo: 'Manual da Fase V do Sistema Audesp — Ajustes 2024',
    versao: 'v00',
    arquivo: 'docs/manual-fase-v-ajustes-2024-v00.pdf',
    bytes: 5943105,
    descricao:
      'Alterações de leiaute e regras introduzidas na Fase V, com a estrutura dos arquivos JSON e as orientações de envio ao sistema.',
  },
];

function tamanho(bytes) {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1).replace('.', ',')} MB`;
  return `${Math.round(bytes / 1024)} KB`;
}

function cartaoManual(manual) {
  const area = el('div', { class: 'pdf-area', hidden: true });
  const ver = el('button', { class: 'btn btn-mini', type: 'button' }, '👁 Ver aqui');

  ver.addEventListener('click', () => {
    const abrir = area.hidden;
    if (abrir && !area.firstChild) {
      area.append(
        el('p', { class: 'dica' }, 'Se a visualização não aparecer (alguns navegadores, sobretudo no celular, bloqueiam PDF embutido), use “Abrir em nova aba”.'),
        el('iframe', {
          class: 'pdf-viewer',
          src: manual.arquivo,
          title: manual.titulo,
          loading: 'lazy',
        }),
      );
    }
    area.hidden = !abrir;
    ver.textContent = abrir ? '✕ Fechar visualização' : '👁 Ver aqui';
    if (abrir) area.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });

  return el('article', { class: 'doc-item' },
    el('div', { class: 'doc-item-topo' },
      el('div', {},
        el('h3', {}, manual.titulo),
        el('div', { class: 'doc-item-meta' },
          el('span', { class: 'chip' }, `PDF · ${manual.versao}`),
          el('span', { class: 'mini' }, tamanho(manual.bytes)),
        ),
      ),
    ),
    el('p', { class: 'doc-item-desc' }, manual.descricao),
    el('div', { class: 'doc-item-acoes' },
      el('a', { class: 'btn btn-primario btn-mini', href: manual.arquivo, target: '_blank', rel: 'noopener' }, '↗ Abrir em nova aba'),
      el('a', { class: 'btn btn-mini', href: manual.arquivo, download: '' }, '⤓ Baixar PDF'),
      ver,
    ),
    area,
  );
}

function tabelaLeiaute(ctx) {
  const linhas = ORDEM_TIPOS.map((tipo) => {
    const doc = ctx.schemas[tipo];
    const def = TIPOS[tipo];
    if (!doc) return null;
    const obrigatorios = stats(doc, {}).req;
    return el('tr', {},
      el('td', {}, el('strong', {}, def.nome), el('div', { class: 'mini' }, def.resumo)),
      el('td', { class: 'num' }, String(doc.sectionKeys.length)),
      el('td', { class: 'num' }, String(obrigatorios)),
      el('td', {}, el('button', {
        class: 'btn btn-ghost btn-mini', type: 'button',
        onclick: () => modalNova(ctx),
      }, 'Criar →')),
    );
  }).filter(Boolean);

  return el('table', { class: 'tabela' },
    el('thead', {}, el('tr', {},
      el('th', {}, 'Documento'),
      el('th', { class: 'num' }, 'Seções'),
      el('th', { class: 'num' }, 'Campos obrigatórios'),
      el('th', {}, ''),
    )),
    el('tbody', {}, ...linhas),
  );
}

export function renderDocs(root, ctx) {
  const pagina = el('div', { class: 'pagina' });
  pagina.append(pageHeader({
    title: 'Documentação',
    subtitle: 'Os manuais oficiais do TCE-SP usados como referência, o leiaute que este sistema gera e os canais de apoio.',
    actions: [el('button', { class: 'btn', type: 'button', onclick: () => ctx.navigate('#/ajuda') }, 'Como usar')],
  }));

  pagina.append(el('div', { class: 'aviso' },
    'Os PDFs abaixo são os arquivos originais do TCE-SP, sem alteração. Eles ficam no próprio site ',
    el('code', {}, 'docs/'), ' e abrem no navegador ou podem ser baixados.'));

  pagina.append(el('div', { class: 'doc-lista' }, ...MANUAIS.map(cartaoManual)));

  pagina.append(el('h2', { class: 'secao-titulo' }, `Leiaute ${ROTULO_VERSAO} — o que este sistema gera`));
  pagina.append(el('p', { class: 'dica', style: 'margin:0 0 10px' },
    'Contagem extraída dos JSON Schemas oficiais: seções do documento e total de campos obrigatórios (recursivo, sem contar itens de lista).'));
  const painel = el('div', { class: 'painel' }, tabelaLeiaute(ctx));
  pagina.append(painel);

  pagina.append(el('h2', { class: 'secao-titulo' }, 'Links oficiais'));
  pagina.append(el('div', { class: 'painel' },
    el('ul', { class: 'lista-links' },
      el('li', {}, el('a', { href: 'https://audesp.tce.sp.gov.br', target: '_blank', rel: 'noopener' }, 'Audesp — sistema de envio'),
        el('span', { class: 'mini' }, ' onde os arquivos JSON são transmitidos')),
      el('li', {}, el('a', { href: 'https://www.tce.sp.gov.br/audesp', target: '_blank', rel: 'noopener' }, 'Página do Audesp no TCE-SP'),
        el('span', { class: 'mini' }, ' manuais, leiautes e comunicados')),
      el('li', {}, el('a', { href: 'https://www.tce.sp.gov.br/', target: '_blank', rel: 'noopener' }, 'Portal do TCE-SP'),
        el('span', { class: 'mini' }, ' normas, jurisprudência e notícias')),
    ),
  ));

  pagina.append(el('div', { class: 'aviso' },
    'Em caso de divergência entre este sistema e o manual, vale o manual do TCE-SP. ',
    'A validação aqui é de leiaute: não substitui a análise contábil nem as regras de negócio do Audesp.'));

  root.replaceChildren(pagina);
}
