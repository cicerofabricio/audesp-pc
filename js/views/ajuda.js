/**
 * ajuda.js — página de orientação.
 */

import { el } from '../util.js';
import { TIPOS, ORDEM_TIPOS } from '../schema.js';
import { pageHeader } from '../ui/shell.js';

export function renderAjuda(root, ctx) {
  const pagina = el('div', { class: 'pagina ajuda-secao' });
  pagina.append(pageHeader({
    title: 'Como usar',
    subtitle: 'Um guia rápido do fluxo de trabalho e das regras que o sistema verifica.',
    actions: [el('button', { class: 'btn btn-primario', type: 'button', onclick: () => ctx.navigate('#/') }, '← Voltar às prestações')],
  }));

  pagina.append(el('h2', {}, 'O que este sistema faz'));
  pagina.append(el('p', {},
    'Ele monta os arquivos JSON de Prestação de Contas do terceiro setor no padrão da Fase V do Audesp (TCE-SP, versão 1.16). ' +
    'O formulário é gerado a partir dos próprios JSON Schemas oficiais, e a validação usa as mesmas regras (campos obrigatórios, ' +
    'tipos, listas, tamanhos, padrões, datas e domínios). No fim você baixa um arquivo .json para conferir no Audesp.',
  ));

  pagina.append(el('h2', {}, 'Fluxo em três passos'));
  pagina.append(el('ol', {},
    el('li', {}, el('b', {}, 'Nova prestação: '), 'informe tipo de documento, município, entidade, ano e mês (fechamento em dezembro).'),
    el('li', {}, el('b', {}, 'Preencha o formulário: '), 'as seções seguem a ordem do leiaute oficial. Listas (empregados, contratos, documentos fiscais, pagamentos, repasses…) aceitam quantos itens forem necessários.'),
    el('li', {}, el('b', {}, 'Valide e baixe: '), 'use “Validar” para ver as pendências, “Conferência” para checar totais e cruzamentos, e “Baixar JSON” para gerar o arquivo de envio.'),
  ));

  pagina.append(el('h2', {}, 'Documentos suportados'));
  const grade = el('div', { class: 'grade-docs' });
  for (const key of ORDEM_TIPOS) {
    const def = TIPOS[key];
    grade.append(el('div', { class: 'doc-card' },
      el('h4', {}, def.nome),
      el('p', {}, def.resumo),
    ));
  }
  pagina.append(grade);

  pagina.append(el('h2', {}, 'Regras aplicadas na validação'));
  pagina.append(el('ul', {},
    el('li', {}, 'Campos marcados com ', el('span', { class: 'obrig' }, '*'), ' são obrigatórios no schema; a seção mostra o contador preenchidos/obrigatórios.'),
    el('li', {}, 'O mês do descritor é fixo em ', el('code', {}, '12'), ' — a prestação é anual.'),
    el('li', {}, 'O código do ajuste tem de 15 a 19 dígitos numéricos.'),
    el('li', {}, 'CPF com 11 dígitos, CNPJ com 14 — apenas números, sem pontos ou traços.'),
    el('li', {}, 'Datas no formato ', el('code', {}, 'AAAA-MM-DD'), ' (o campo de data já entrega assim).'),
    el('li', {}, 'Valores monetários com até 2 casas decimais; cargas horárias em múltiplos de 0,5.'),
    el('li', {}, 'Os campos de domínio usam a lista oficial; o sistema mostra o código e a descrição (ex.: “1 — Diário Oficial do Município”).'),
    el('li', {}, 'Campos não previstos no leiaute são rejeitados na importação.'),
  ));

  pagina.append(el('h2', {}, 'Importar arquivos'));
  pagina.append(el('p', {},
    'Em “Importar JSON” você pode carregar: um JSON gerado pelo próprio sistema, um arquivo bruto no padrão Audesp ' +
    '(o tipo é identificado pelo ', el('code', {}, 'descritor.tipo_documento'), ') ou um backup completo (vários documentos de uma vez).',
  ));

  pagina.append(el('h2', {}, 'Onde ficam os dados'));
  pagina.append(el('p', {},
    'Tudo é gravado no seu navegador (IndexedDB) — nada é enviado para servidor algum. Por isso: ' +
    'use sempre o mesmo navegador e computador, e gere um ', el('b', {}, 'Backup'), ' com regularidade. ' +
    'Limpar os dados de navegação apaga os registros, mas nunca os arquivos JSON que você baixou.',
  ));

  pagina.append(el('h2', {}, 'Publicar a página (GitHub Pages)'));
  pagina.append(el('p', {},
    'Esta é uma página estática: basta subir a pasta para um repositório no GitHub e ativar o GitHub Pages. ' +
    'O passo a passo completo está no arquivo ', el('code', {}, 'README.md'), ' que acompanha o sistema.',
  ));

  pagina.append(el('h2', {}, 'Limites e responsabilidade'));
  pagina.append(el('div', { class: 'aviso' },
    'A validação aqui reproduz o schema, mas não substitui as regras de negócio do Audesp nem o manual oficial. ' +
    'A conferência final e o envio são de responsabilidade do órgão. Em caso de divergência, vale o manual do TCE-SP.',
  ));
  pagina.append(el('p', {},
    'Referências: ',
    el('a', { href: 'https://audesp.tce.sp.gov.br', target: '_blank', rel: 'noopener' }, 'Audesp — TCE-SP'),
    ' · ',
    el('a', { href: 'https://www.tce.sp.gov.br/audesp', target: '_blank', rel: 'noopener' }, 'Manuais e leiautes'),
  ));

  root.replaceChildren(pagina);
}
