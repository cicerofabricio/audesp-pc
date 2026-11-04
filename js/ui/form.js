/**
 * form.js — formulário gerado a partir do JSON Schema do Audesp.
 * Suporta objetos aninhados, listas de objetos, listas dentro de listas,
 * enums com rótulos oficiais, datas, CPF/CNPJ, valores com 2 casas e Sim/Não.
 */

import { el, pathKey, getIn, setIn, deleteIn, clone } from '../util.js';
import { resolve, nodeType, enumOptions, titleOf, hintsOf, exampleOf } from '../schema.js';
import { tipoDeMascara, aplicarMascara, formatarNumero, formatarCPF, formatarCNPJ, soDigitos } from '../mascara.js';
import { conteudoAjuda, resumoAjuda } from '../ajuda-campo.js';

export class Form {
  constructor({ doc, data, onChange }) {
    this.doc = doc;
    this.data = data;
    this.onChange = onChange || (() => {});
    this.root = el('div', { class: 'form' });
    this.sections = new Map();
    this._documentos = new Map();
    this._fecharAjudas = (ev) => {
      for (const pop of this.root.querySelectorAll('.ajuda-pop')) {
        if (ev && pop.parentElement && pop.parentElement.contains(ev.target)) continue;
        pop.hidden = true;
        const btn = pop.parentElement && pop.parentElement.querySelector('.ajuda-btn');
        if (btn) btn.setAttribute('aria-expanded', 'false');
      }
    };
    document.addEventListener('click', this._fecharAjudas);
    document.addEventListener('keydown', (ev) => { if (ev.key === 'Escape') this._fecharAjudas(); });
  }

  /* --------------------------------------------------------------- montagem */

  render() {
    this.root.replaceChildren();
    this.sections.clear();
    const raw = this.doc.raw;
    const required = new Set(raw.required || []);
    for (const grupo of this.doc.grupos) {
      const g = el('div', { class: 'grupo' }, el('h2', { class: 'grupo-titulo' }, grupo.titulo));
      for (const key of grupo.chaves) {
        const node = resolve(this.doc, (raw.properties || {})[key]);
        if (!node) continue;
        g.append(this.section(key, node, required.has(key)));
      }
      this.root.append(g);
    }
    return this.root;
  }

  section(key, node, required) {
    const type = nodeType(this.doc, node);
    const badge = el('span', { class: 'sec-badge' }, '—');
    const extra = el('span', { class: 'sec-extra' });
    const head = el('div', {
      class: 'sec-head',
      role: 'button',
      tabIndex: 0,
      dataset: { sec: key },
      onclick: () => this.toggleSection(key),
      onkeydown: (ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); this.toggleSection(key); } },
    },
      el('span', { class: 'chev' }, '▾'),
      el('span', { class: 'sec-title' }, titleOf(this.doc, node, key)),
      required ? el('span', { class: 'req-dot', title: 'Seção obrigatória' }) : null,
      extra,
      badge,
    );
    const body = el('div', { class: 'sec-body' });

    if (type === 'object') {
      this.appendObjectFields(body, node, this.data ? this.data[key] : undefined, [key], node);
    } else if (type === 'array') {
      body.append(this.buildArray(node, this.data ? this.data[key] : undefined, [key]));
    } else {
      body.append(this.field(key, node, this.data ? this.data[key] : undefined, [key], required, true));
    }

    const sec = el('section', { class: 'secao', dataset: { sec: key } }, head, body);
    this.sections.set(key, { sec, head, body, badge, extra, node, type });
    return sec;
  }

  appendObjectFields(container, parentNode, value, path, sectionNode) {
    const required = new Set(parentNode.required || []);
    const props = parentNode.properties || {};
    for (const [key, childRaw] of Object.entries(props)) {
      const child = resolve(this.doc, childRaw);
      if (!child) continue;
      const childPath = [...path, key];
      const childType = nodeType(this.doc, child);
      if (childType === 'object') {
        container.append(this.subBlock(key, child, value ? value[key] : undefined, childPath, required.has(key)));
      } else if (childType === 'array') {
        container.append(this.subBlock(key, child, value ? value[key] : undefined, childPath, required.has(key)));
      } else {
        container.append(this.field(key, child, value ? value[key] : undefined, childPath, required.has(key)));
      }
    }
    if (!Object.keys(props).length) container.append(el('div', { class: 'vazio' }, 'Sem campos previstos.'));
  }

  /** Bloco aninhado (objeto ou lista dentro de objeto). */
  subBlock(key, node, value, path, required) {
    const type = nodeType(this.doc, node);
    const bloco = el('div', { class: 'subbloco', dataset: { path: pathKey(path) } });
    const legend = el('div', { class: 'subbloco-titulo' },
      el('span', {}, titleOf(this.doc, node, key)),
      required ? el('span', { class: 'obrig' }, ' *') : null,
      type === 'array' ? el('span', { class: 'mini', dataset: { countFor: pathKey(path) } }) : null,
    );
    bloco.append(legend);
    if (type === 'object') {
      const inner = el('div', { class: 'subbloco-corpo' });
      this.appendObjectFields(inner, node, value, path, node);
      bloco.append(inner);
    } else {
      bloco.append(this.buildArray(node, value, path));
    }
    bloco.append(el('div', { class: 'erro' }));
    return bloco;
  }

  /* ------------------------------------------------------------------ campo */

  field(key, node, value, path, required, semRotulo = false) {
    const type = nodeType(this.doc, node);
    const titulo = titleOf(this.doc, node, key);
    const wrap = el('div', { class: `campo campo-${type}`, dataset: { path: pathKey(path) } });
    if (!semRotulo) {
      wrap.append(el('div', { class: 'rotulo-linha' },
        el('label', { class: 'rotulo', title: resumoAjuda(this.doc, node) || null },
          titulo,
          required ? el('span', { class: 'obrig', title: 'Campo obrigatório' }, ' *') : null,
        ),
        this.botaoAjuda(node, key, titulo, required),
      ));
    }
    const ctrl = this.control(node, value, path);
    if (semRotulo) ctrl.setAttribute('aria-label', titulo);
    ctrl.addEventListener('blur', () => wrap.classList.add('tocado'));
    ctrl.addEventListener('change', () => wrap.classList.add('tocado'));
    wrap.append(ctrl);
    let hints = hintsOf(this.doc, node);
    if (path[path.length - 1] === 'documento_numero') {
      const tipo = getIn(this.data, [...path.slice(0, -1), 'documento_tipo']);
      hints = [tipo === 2 ? 'somente números · CNPJ com 14 dígitos'
        : tipo === 3 ? 'RNE — até 14 caracteres'
          : 'somente números · CPF com 11 dígitos'];
    }
    if (hints.length) wrap.append(el('div', { class: 'dica' }, hints.join(' · ')));
    wrap.append(el('div', { class: 'erro' }));
    return wrap;
  }

  /** Botão “?” com a explicação detalhada do campo. */
  botaoAjuda(node, chave, titulo, obrigatorio) {
    const btn = el('button', {
      class: 'ajuda-btn', type: 'button', 'aria-label': `Ajuda do campo ${titulo}`,
      'aria-expanded': 'false', title: 'O que preencher aqui?',
    }, '?');
    const pop = el('div', { class: 'ajuda-pop', role: 'tooltip', hidden: true });
    const caixa = el('span', { class: 'ajuda-caixa' }, btn, pop);

    btn.addEventListener('click', (ev) => {
      ev.stopPropagation();
      this._fecharAjudas(ev);
      if (!pop.dataset.pronto) {
        pop.append(...conteudoAjuda(this.doc, node, chave, obrigatorio));
        pop.dataset.pronto = '1';
      }
      pop.hidden = !pop.hidden;
      btn.setAttribute('aria-expanded', String(!pop.hidden));
      if (!pop.hidden) {
        // abre para cima quando não há espaço suficiente abaixo do campo
        pop.classList.remove('acima');
        const caixa = pop.getBoundingClientRect();
        if (caixa.bottom > window.innerHeight - 12 && caixa.top > window.innerHeight / 3) {
          pop.classList.add('acima');
        }
      }
    });
    return caixa;
  }

  control(node, value, path) {
    if (path[path.length - 1] === 'documento_numero') return this.documentoInput(node, value, path);
    const mascara = tipoDeMascara(node);
    if (mascara) return this.maskedInput(node, value, path, mascara);
    if (Array.isArray(node.enum) && node.enum.length) return this.selectControl(node, value, path);
    const type = nodeType(this.doc, node);
    if (type === 'boolean') return this.selectBoolean(value, path);
    if (type === 'number' && node.multipleOf === 0.01) return this.moneyInput(node, value, path);
    if (type === 'integer' || type === 'number') return this.numberInput(node, value, path, type);
    if (node.format === 'date') return this.dateInput(value, path);
    return this.textInput(node, value, path);
  }

  /**
   * Número do documento do credor: o leiaute aceita CPF (11), CNPJ (14) ou RNE,
   * conforme o campo “tipo” ao lado. A máscara acompanha o tipo escolhido e o
   * dado gravado continua sendo só dígitos (ou o texto do RNE).
   */
  documentoInput(node, value, path) {
    const base = path.slice(0, -1);
    const tipoPath = [...base, 'documento_tipo'];

    const definicao = () => {
      const tipo = getIn(this.data, tipoPath);
      if (tipo === 2) return { modo: 'cnpj', max: 14, limite: 18, formato: formatarCNPJ, exemplo: '00.000.000/0000-00' };
      if (tipo === 3) return { modo: 'rne', max: 14, limite: 14, formato: (v) => v, exemplo: 'RNE — até 14 caracteres' };
      return { modo: 'cpf', max: 11, limite: 14, formato: formatarCPF, exemplo: '000.000.000-00' };
    };

    let atual = definicao();
    const input = el('input', {
      class: 'entrada entrada-mascara',
      type: 'text',
      autocomplete: 'off',
      spellcheck: false,
      maxLength: atual.limite,
      placeholder: atual.exemplo,
      inputmode: atual.modo === 'rne' ? null : 'numeric',
    });

    const aplicarValor = () => {
      const bruto = String(getIn(this.data, path) ?? '');
      input.value = atual.modo === 'rne' ? bruto.toUpperCase().slice(0, 14) : atual.formato(soDigitos(bruto));
    };
    aplicarValor();

    input.addEventListener('input', () => {
      if (atual.modo === 'rne') {
        const limpo = input.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, atual.max);
        input.value = limpo;
        this.write(path, limpo || undefined);
        return;
      }
      const digitos = aplicarMascara(input, { max: atual.max, formato: atual.formato });
      this.write(path, digitos || undefined);
    });

    input.addEventListener('focus', () => {
      const pos = input.value.length;
      try { input.setSelectionRange(pos, pos); } catch { /* ignora */ }
    });

    this._documentos.set(pathKey(base), {
      reconfigurar: () => {
        const novo = definicao();
        if (novo.modo === atual.modo) return;
        atual = novo;
        input.maxLength = novo.limite;
        input.placeholder = novo.exemplo;
        input.inputMode = novo.modo === 'rne' ? '' : 'numeric';
        // o número anterior não serve para o novo tipo: limpa e sinaliza
        input.value = '';
        deleteIn(this.data, path);
        const campo = input.closest('.campo');
        if (campo) {
          const dica = campo.querySelector('.dica');
          if (dica) {
            dica.textContent = novo.modo === 'cnpj' ? 'somente números · CNPJ com 14 dígitos'
              : novo.modo === 'rne' ? 'RNE — até 14 caracteres'
                : 'somente números · CPF com 11 dígitos';
          }
          campo.classList.add('tocado', 'limpou');
          setTimeout(() => campo.classList.remove('limpou'), 900);
        }
      },
    });

    return input;
  }

  /** CPF, CNPJ e códigos numéricos com máscara e cursor estável. */
  maskedInput(node, value, path, mascara) {
    const input = el('input', {
      class: 'entrada entrada-mascara',
      type: 'text',
      inputmode: 'numeric',
      autocomplete: 'off',
      spellcheck: false,
      maxLength: mascara.tipo === 'cpf' ? 14 : mascara.tipo === 'cnpj' ? 18 : mascara.max,
      placeholder: mascara.exemplo,
    });
    input.value = mascara.formato(soDigitos(value));
    input.addEventListener('input', () => {
      const digitos = aplicarMascara(input, mascara);
      this.write(path, digitos || undefined);
    });
    input.addEventListener('focus', () => {
      const pos = input.value.length;
      input.setSelectionRange(pos, pos);
    });
    return input;
  }

  /** Valores monetários: aceita vírgula, bloqueia letras e fecha em 2 casas. */
  moneyInput(node, value, path) {
    const input = el('input', {
      class: 'entrada entrada-moeda',
      type: 'text',
      inputmode: 'decimal',
      autocomplete: 'off',
      placeholder: '0,00',
    });
    const mostrar = () => {
      const v = getIn(this.data, path);
      input.value = typeof v === 'number' ? formatarNumero(v) : '';
    };
    mostrar();
    input.addEventListener('focus', () => {
      const v = getIn(this.data, path);
      if (typeof v === 'number') input.value = String(v).replace('.', ',');
      input.select();
    });
    input.addEventListener('input', () => {
      const limpo = input.value.replace(/[^\d,.-]/g, '').replace(/\./g, ',');
      if (limpo !== input.value) input.value = limpo;
      if (limpo.trim() === '' || limpo === ',') return this.write(path, undefined);
      const n = Number(limpo.replace(',', '.'));
      if (Number.isNaN(n)) return;
      this.write(path, Math.round(n * 100) / 100);
    });
    input.addEventListener('blur', () => {
      const v = getIn(this.data, path);
      input.value = typeof v === 'number' ? formatarNumero(v) : '';
    });
    return input;
  }

  /** Grava o valor no caminho e avisa a tela. */
  write(path, value) {
    if (value === undefined || value === null || value === '') deleteIn(this.data, path);
    else setIn(this.data, path, value);

    // o número do documento do credor depende do tipo escolhido ao lado
    if (path[path.length - 1] === 'documento_tipo' && this._documentos) {
      const dependente = this._documentos.get(pathKey(path.slice(0, -1)));
      if (dependente) dependente.reconfigurar();
    }

    this.onChange();
  }

  selectControl(node, value, path) {
    const opts = enumOptions(this.doc, node);
    const sel = el('select', { class: 'entrada' });
    sel.append(el('option', { value: '' }, '— selecione —'));
    for (const o of opts) {
      const opt = el('option', { value: String(o.value) }, o.label);
      if (String(o.value) === String(value ?? '')) opt.selected = true;
      sel.append(opt);
    }
    sel.addEventListener('change', () => {
      const raw = sel.value;
      if (raw === '') return this.write(path, undefined);
      const num = Number(raw);
      this.write(path, Number.isNaN(num) || String(num) !== raw ? raw : num);
    });
    sel.addEventListener('blur', () => sel.closest('.campo')?.classList.add('tocado'));
    return sel;
  }

  selectBoolean(value, path) {
    const sel = el('select', { class: 'entrada' });
    sel.append(el('option', { value: '' }, '— selecione —'));
    const sim = el('option', { value: 'true' }, 'Sim');
    const nao = el('option', { value: 'false' }, 'Não');
    if (value === true) sim.selected = true;
    if (value === false) nao.selected = true;
    sel.append(sim, nao);
    sel.addEventListener('change', () => {
      if (sel.value === '') return this.write(path, undefined);
      this.write(path, sel.value === 'true');
    });
    return sel;
  }

  numberInput(node, value, path, type) {
    const step = typeof node.multipleOf === 'number' && node.multipleOf > 0 ? node.multipleOf : (type === 'integer' ? 1 : 0.01);
    const input = el('input', {
      class: 'entrada',
      type: 'number',
      inputmode: type === 'integer' ? 'numeric' : 'decimal',
      step: String(step),
      min: node.minimum !== undefined ? String(node.minimum) : null,
      max: node.maximum !== undefined ? String(node.maximum) : null,
      placeholder: exampleOf(this.doc, node) !== null ? String(exampleOf(this.doc, node)).replace('.', ',') : null,
    });
    if (typeof value === 'number') input.value = String(value);
    input.addEventListener('input', () => {
      const raw = input.value.trim();
      if (raw === '' || raw === '-') return this.write(path, undefined);
      const num = Number(raw);
      if (Number.isNaN(num)) return;
      this.write(path, type === 'integer' && Number.isInteger(num) ? num : num);
    });
    return input;
  }

  dateInput(value, path) {
    const input = el('input', { class: 'entrada', type: 'date' });
    if (typeof value === 'string') input.value = value;
    input.addEventListener('input', () => this.write(path, input.value || undefined));
    return input;
  }

  textInput(node, value, path) {
    const maxLength = typeof node.maxLength === 'number' ? node.maxLength : null;
    const long = maxLength !== null && maxLength > 200;
    const placeholder = exampleOf(this.doc, node);
    const input = long
      ? el('textarea', { class: 'entrada', rows: 3, maxLength, placeholder: placeholder === null ? null : String(placeholder) })
      : el('input', {
        class: 'entrada',
        type: node.format === 'uri' ? 'url' : 'text',
        maxLength,
        placeholder: placeholder === null ? null : String(placeholder),
        autocomplete: 'off',
      });
    if (value !== undefined && value !== null) input.value = String(value);
    input.addEventListener('input', () => this.write(path, input.value));
    input.addEventListener('blur', () => {
      const v = input.value.trim();
      if (v !== input.value) {
        input.value = v;
        this.write(path, v);
      }
    });
    return input;
  }

  /* ------------------------------------------------------------------ listas */

  buildArray(node, value, path) {
    const cont = el('div', { class: 'lista', dataset: { arr: pathKey(path) } });
    const count = el('span', { class: 'mini' });
    const add = el('button', {
      class: 'btn btn-mini', type: 'button',
      onclick: () => this.addItem(path, node),
    }, '＋ Adicionar');
    const head = el('div', { class: 'lista-topo' }, count, add);
    const items = el('div', { class: 'itens' });
    if (!Array.isArray(value) || !value.length) {
      items.append(el('div', { class: 'vazio' }, 'Nenhum item. Use “Adicionar” para incluir.'));
    } else {
      this.fillItems(items, node, value, path);
    }
    cont.append(head, items);
    this.updateCount(cont, path, value);
    return cont;
  }

  fillItems(items, node, arr, path) {
    items.replaceChildren();
    if (!arr.length) {
      items.append(el('div', { class: 'vazio' }, 'Nenhum item. Use “Adicionar” para incluir.'));
      return;
    }
    arr.forEach((item, i) => items.append(this.itemCard(node, item, [...path, i])));
  }

  itemCard(node, value, path) {
    const itemNode = resolve(this.doc, node.items);
    const type = nodeType(this.doc, itemNode);
    const card = el('div', { class: 'item', dataset: { path: pathKey(path) } });
    const titulo = titleOf(this.doc, itemNode, '') || '';
    const head = el('div', { class: 'item-head' },
      el('span', { class: 'item-num' }, `#${path[path.length - 1] + 1}`),
      el('span', { class: 'item-titulo' }, titulo && titulo !== 'Items' ? titulo : ''),
      el('span', { class: 'item-acoes' },
        el('button', { class: 'btn btn-ghost btn-mini', type: 'button', title: 'Duplicar item', onclick: () => this.duplicateItem(path, node) }, '⧉'),
        el('button', { class: 'btn btn-ghost btn-mini perigo', type: 'button', title: 'Remover item', onclick: () => this.removeItem(path, node) }, '✕'),
      ),
    );
    const body = el('div', { class: 'item-corpo' });
    if (type === 'object') {
      this.appendObjectFields(body, itemNode, value, path, itemNode);
    } else {
      body.append(this.field(path[path.length - 1] + '', itemNode, value, path, true));
    }
    card.append(head, body);
    return card;
  }

  arrayNode(path) {
    let node = resolve(this.doc, this.doc.raw);
    for (const step of path) {
      if (!node) return null;
      node = resolve(this.doc, typeof step === 'number' ? node.items : (node.properties || {})[step]);
    }
    return node;
  }

  blankItem(node) {
    const item = resolve(this.doc, node.items) || {};
    const type = nodeType(this.doc, item);
    if (type === 'object') return {};
    if (type === 'boolean') return false;
    if (type === 'integer' || type === 'number') return 0;
    return '';
  }

  addItem(path, node) {
    const list = getIn(this.data, path);
    const target = Array.isArray(list) ? list : [];
    if (!Array.isArray(list)) setIn(this.data, path, target);
    target.push(this.blankItem(node));
    this.repaintArray(path);
    this.onChange();
  }

  duplicateItem(path, node) {
    const arrPath = path.slice(0, -1);
    const list = getIn(this.data, arrPath);
    if (!Array.isArray(list)) return;
    const i = path[path.length - 1];
    list.splice(i + 1, 0, clone(list[i]));
    this.repaintArray(arrPath);
    this.onChange();
  }

  removeItem(path, node) {
    const arrPath = path.slice(0, -1);
    const list = getIn(this.data, arrPath);
    if (!Array.isArray(list)) return;
    list.splice(path[path.length - 1], 1);
    this.repaintArray(arrPath);
    this.onChange();
  }

  repaintArray(path) {
    const key = pathKey(path);
    const cont = this.root.querySelector(`[data-arr="${key}"]`);
    if (!cont) return;
    const arr = getIn(this.data, path);
    const node = this.arrayNode(path);
    const items = cont.querySelector('.itens');
    if (!items || !node) return;
    this.fillItems(items, node, Array.isArray(arr) ? arr : [], path);
    this.updateCount(cont, path, arr);
  }

  updateCount(cont, path, arr) {
    const c = cont.querySelector(':scope > .lista-topo > .mini');
    const n = Array.isArray(arr) ? arr.length : 0;
    if (c) c.textContent = n === 1 ? '1 item' : `${n} itens`;
    const mini = this.root.querySelector(`[data-count-for="${pathKey(path)}"]`);
    if (mini) mini.textContent = n ? ` ${n}` : '';
  }

  /* ------------------------------------------------------------- pintura */

  toggleSection(key) {
    const s = this.sections.get(key);
    if (!s) return;
    s.sec.classList.toggle('colapsada');
  }

  expandAll(open) {
    for (const s of this.sections.values()) s.sec.classList.toggle('colapsada', !open);
  }

  /** Atualiza contadores e estado das seções. */
  refresh(statsResult) {
    if (!statsResult) return;
    for (const [key, s] of this.sections) {
      const st = statsResult.sections[key] || { req: 0, filled: 0 };
      s.badge.textContent = st.req ? `${st.filled}/${st.req}` : '—';
      s.badge.classList.toggle('ok', st.req > 0 && st.filled >= st.req);
      const arr = getIn(this.data, [key]);
      s.extra.textContent = Array.isArray(arr) ? (arr.length ? `${arr.length} ${arr.length === 1 ? 'item' : 'itens'}` : '') : '';
    }
  }

  /** Marca campos com erro e escreve as mensagens. */
  paint(byPath, force = false) {
    for (const node of this.root.querySelectorAll('[data-path]')) {
      let msg = byPath.get(node.dataset.path) || '';
      if (msg === 'Campo obrigatório' && !force && !node.classList.contains('tocado')) msg = '';
      node.classList.toggle('invalido', Boolean(msg));
      const err = node.querySelector(':scope > .erro');
      if (err) err.textContent = msg;
    }
  }

  focusFirstError() {
    const first = this.root.querySelector('.invalido');
    if (!first) return false;
    first.scrollIntoView({ behavior: 'smooth', block: 'center' });
    const input = first.querySelector('input, select, textarea');
    if (input) setTimeout(() => input.focus({ preventScroll: true }), 250);
    return true;
  }

  goToSection(key) {
    const s = this.sections.get(key);
    if (!s) return;
    s.sec.classList.remove('colapsada');
    s.sec.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}
