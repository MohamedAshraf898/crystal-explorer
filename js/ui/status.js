import { statusLabel } from '../lib/format.js';
import { h } from '../lib/dom.js';

const ICONS = {
  available: '<circle cx="6" cy="6" r="4.2" fill="currentColor"/>',
  reserved: '<circle cx="6" cy="6" r="4.2" fill="none" stroke="currentColor" stroke-width="1.2"/><path d="M6 1.8a4.2 4.2 0 0 1 0 8.4z" fill="currentColor"/>',
  sold: '<circle cx="6" cy="6" r="4.2" fill="none" stroke="currentColor" stroke-width="1.2"/><path d="M3.2 8.8 8.8 3.2" stroke="currentColor" stroke-width="1.2"/>',
};

/** Status shown by shape + text, never by colour alone. */
export function statusIcon(status) {
  const t = document.createElement('template');
  t.innerHTML = `<svg class="status-icon" viewBox="0 0 12 12" aria-hidden="true" focusable="false">${ICONS[status]}</svg>`;
  return t.content.firstElementChild;
}

export function statusBadge(status, size = 'sm') {
  return h('span', { className: `status status--${status} status--${size}` }, statusIcon(status), h('span', {}, statusLabel[status]));
}
