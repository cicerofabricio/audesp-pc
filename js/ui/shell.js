/**
 * shell.js — notificações (toasts) e diálogos modais.
 */

import { el } from '../util.js';

export function toast(message, kind = 'info', ms = 4000) {
  let box = document.getElementById('toasts');
  if (!box) {
    box = el('div', { id: 'toasts', class: 'toasts' });
    document.body.append(box);
  }
  const t = el('div', { class: `toast toast-${kind}` },
    el('span', { class: 'toast-msg' }, message),
    el('button', { class: 'toast-x', type: 'button', 'aria-label': 'Fechar' }, '✕'),
  );
  t.querySelector('.toast-x').addEventListener('click', () => t.remove());
  box.append(t);
  setTimeout(() => {
    t.classList.add('saindo');
    setTimeout(() => t.remove(), 320);
  }, ms);
  return t;
}

/**
 * Abre um modal. `actions` = [{label, value, kind}] — resolve com o value clicado.
 * `render(close)` pode montar conteúdo dinâmico.
 */
export function openModal({ title, content, actions, wide = false, onMount }) {
  const root = document.getElementById('modal-root') || document.body;
  return new Promise((resolve) => {
    const overlay = el('div', { class: 'modal-overlay' });
    const box = el('div', { class: `modal${wide ? ' wide' : ''}`, role: 'dialog', 'aria-modal': 'true' });
    const close = (value = null) => {
      overlay.remove();
      document.removeEventListener('keydown', onKey);
      resolve(value);
    };
    const onKey = (ev) => { if (ev.key === 'Escape') close(null); };

    const head = el('div', { class: 'modal-head' },
      el('h2', {}, title),
      el('button', { class: 'btn btn-ghost btn-mini', type: 'button', 'aria-label': 'Fechar', onclick: () => close(null) }, '✕'),
    );
    const body = el('div', { class: 'modal-body' });
    if (typeof content === 'string') body.append(el('p', {}, content));
    else if (content) body.append(content);
    box.append(head, body);

    if (actions && actions.length) {
      const foot = el('div', { class: 'modal-foot' });
      for (const a of actions) {
        foot.append(el('button', {
          class: `btn ${a.kind || 'btn-ghost'}`, type: 'button',
          onclick: () => close(a.value === undefined ? a.label : a.value),
        }, a.label));
      }
      box.append(foot);
    }

    overlay.append(box);
    overlay.addEventListener('mousedown', (ev) => { if (ev.target === overlay) close(null); });
    document.addEventListener('keydown', onKey);
    root.append(overlay);
    if (onMount) onMount({ box, body, close });
    const first = box.querySelector('input, select, textarea, button.btn-primario');
    if (first) setTimeout(() => first.focus(), 60);
  });
}

export async function confirmDialog({ title = 'Confirmar', message, confirmLabel = 'Confirmar', danger = false }) {
  const res = await openModal({
    title,
    content: message,
    actions: [
      { label: 'Cancelar', value: false },
      { label: confirmLabel, value: true, kind: danger ? 'btn-perigo' : 'btn-primario' },
    ],
  });
  return res === true;
}

/** Cabeçalho padrão de página. */
export function pageHeader({ title, subtitle, actions }) {
  const head = el('header', { class: 'pagina-topo' },
    el('div', { class: 'pagina-titulos' },
      el('h1', {}, title),
      subtitle ? el('p', { class: 'pagina-sub' }, subtitle) : null,
    ),
    el('div', { class: 'pagina-acoes' }, actions || []),
  );
  return head;
}
