import gsap from 'gsap';
import { apartmentsById } from '../data/apartments.js';
import { floors } from '../data/project.js';
import { flag, h, isMobile, render } from '../lib/dom.js';
import { formatArea, formatPrice, pad2 } from '../lib/format.js';
import { COMPARE_MAX } from '../state.js';
import { paymentSchedule } from '../data/paymentPlans.js';
import { statusBadge } from './status.js';
import { unitFigure } from './unitFigure.js';

/**
 * Compare apartments side by side.
 *  - tray: the picked apartments (up to COMPARE_MAX) + "Compare" button
 *  - view: full-screen table, one column per apartment, best value per row marked
 * Apartments are added from the details panel or the finder results.
 */

const yesNo = (v) => (v ? 'Yes' : '—');
const m2 = (v) => (v ? formatArea(v) : '—');
/** Price per m², rounded to EGP 1,000 (compared as shown, so ties are ties). */
const perM2 = (a) => (a.price == null ? null : Math.round(a.price / a.area / 1000) * 1000);

/** Rows of the comparison. `best` picks the winning value ('min' | 'max'). */
const ROWS = [
  { label: 'Price', value: (a) => a.price, show: (a) => formatPrice(a.price) + (a.estimated && a.price != null ? ' *' : ''), best: 'min' },
  { label: 'Price per m²', value: (a) => perM2(a), show: (a) => (a.price == null ? '—' : formatPrice(perM2(a))), best: 'min' },
  { label: 'Down payment', value: (a) => paymentSchedule(a.price, '10y')?.down, show: (a) => (a.price == null ? '—' : formatPrice(paymentSchedule(a.price, '10y').down)), best: 'min' },
  { label: 'Monthly, 10-yr plan', value: (a) => paymentSchedule(a.price, '10y')?.monthlyRange[0], show: (a) => (a.price == null ? '—' : `from ${formatPrice(paymentSchedule(a.price, '10y').monthlyRange[0])}`), best: 'min' },
  { label: 'Built-up area', value: (a) => a.area, show: (a) => formatArea(a.area), best: 'max' },
  { label: 'Bedrooms', value: (a) => a.layout.bedrooms, show: (a) => `${a.layout.bedrooms}${a.layout.masterSuite ? ' (incl. master)' : ''}`, best: 'max' },
  { label: 'Bathrooms', value: (a) => a.layout.bathrooms, show: (a) => String(a.layout.bathrooms), best: 'max' },
  { label: 'Guest toilet', value: (a) => a.layout.toilets, show: (a) => (a.layout.toilets ? String(a.layout.toilets) : '—') },
  { label: 'Living', show: (a) => [a.layout.reception, a.layout.living && 'living room'].filter(Boolean).join(' + ') },
  { label: 'Dressing room', show: (a) => yesNo(a.layout.dressing) },
  { label: 'Terraces', value: (a) => a.layout.terraces, show: (a) => (a.layout.terraces ? String(a.layout.terraces) : '—') },
  { label: 'Private terrace', value: (a) => a.layout.roofTerrace, show: (a) => m2(a.layout.roofTerrace), best: 'max' },
  { label: 'Private garden', value: (a) => a.layout.garden, show: (a) => m2(a.layout.garden), best: 'max' },
  { label: 'Private pool', show: (a) => yesNo(a.layout.pool) },
  { label: 'Floor', show: (a) => floors.find((f) => f.level === a.floor).name },
  { label: 'Status', show: (a) => statusBadge(a.status) },
];

export function createCompare(store) {
  const { actions } = store;

  /* ── tray ────────────────────────────────────────────────────────────── */
  const chips = h('ul', { className: 'compare-tray__chips' });
  const openBtn = h('button', { type: 'button', className: 'btn btn--solid compare-tray__open', onClick: () => actions.openCompare() });
  const tray = h(
    'section',
    { className: 'compare-tray', 'aria-label': 'Apartments to compare' },
    h('p', { className: 'eyebrow compare-tray__label' }, 'Compare'),
    chips,
    openBtn,
    h('button', { type: 'button', className: 'compare-tray__clear', onClick: () => actions.clearCompare() }, 'Clear'),
  );
  tray.inert = true;
  let trayShown = false;

  function renderTray(ids) {
    render(
      chips,
      ids.map((id) => {
        const a = apartmentsById.get(id);
        return h(
          'li',
          { className: 'chip' },
          h('span', {}, `Apt ${pad2(a.number)}`, h('small', {}, ` · F${pad2(a.floor)}`)),
          h('button', { type: 'button', className: 'chip__remove', 'aria-label': `Remove apartment ${a.number}, floor ${a.floor} from compare`, onClick: () => actions.toggleCompare(id) }, '×'),
        );
      }),
      ids.length < COMPARE_MAX && h('li', { className: 'chip chip--empty', 'aria-hidden': 'true' }, `+ ${COMPARE_MAX - ids.length}`),
    );
    openBtn.disabled = ids.length < 2;
    render(openBtn, ids.length < 2 ? 'Add one more' : `Compare ${ids.length}`, h('span', { className: 'btn__arrow', 'aria-hidden': 'true' }, '→'));
  }

  function showTray(v) {
    if (v === trayShown) return;
    trayShown = v;
    tray.inert = !v;
    flag(tray, 'visible', v);
    if (v) gsap.fromTo(tray, { autoAlpha: 0, y: 16 }, { autoAlpha: 1, y: 0, duration: 0.5, ease: 'power3.out' });
    else gsap.to(tray, { autoAlpha: 0, y: 16, duration: 0.3, ease: 'power2.in' });
  }

  /* ── comparison view ─────────────────────────────────────────────────── */
  const table = h('div', { className: 'compare__scroll' });
  const view = h(
    'section',
    { className: 'compare', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'compare-title', onKeydown: (e) => e.key === 'Escape' && (e.stopPropagation(), actions.closeCompare()) },
    h(
      'header',
      { className: 'compare__head' },
      h('div', {}, h('p', { className: 'eyebrow' }, 'Side by side'), h('h2', { id: 'compare-title', className: 'compare__title', tabindex: -1 }, 'Compare apartments')),
      h('button', { type: 'button', className: 'icon-btn compare__close', 'aria-label': 'Close comparison', onClick: () => actions.closeCompare() }, closeIcon()),
    ),
    table,
    h('p', { className: 'compare__note' }, '* Estimated price. Contact sales for official prices and payment plans. Plans are for illustration.'),
  );
  view.inert = true;
  let viewShown = false;
  let returnFocus = null;

  function renderView(ids) {
    const list = ids.map((id) => apartmentsById.get(id));
    const cols = `var(--label-col) repeat(${list.length}, minmax(var(--col-min), 1fr))`;
    const best = (row) => {
      if (!row.best || list.length < 2) return new Set();
      const vals = list.map(row.value).filter((v) => v != null && v !== 0);
      if (!vals.length) return new Set();
      const target = row.best === 'min' ? Math.min(...vals) : Math.max(...vals);
      // only mark a winner when the apartments actually differ
      if (vals.length === list.length && vals.every((v) => v === target)) return new Set();
      return new Set(list.filter((a) => row.value(a) === target).map((a) => a.id));
    };
    render(
      table,
      h(
        'div',
        { className: 'compare__grid', role: 'table', 'aria-label': 'Apartment comparison', style: `grid-template-columns: ${cols}` },
        // header row: plan + name + actions
        h(
          'div',
          { className: 'compare__row', role: 'row' },
          h('div', { className: 'compare__corner', role: 'columnheader' }, h('span', { className: 'sr-only' }, 'Feature')),
          ...list.map((a) =>
          h(
            'div',
            { className: 'compare__col-head', role: 'columnheader' },
            unitFigure(a, null),
            h('p', { className: 'compare__name' }, `Apartment ${a.number}`),
            h('p', { className: 'compare__sub' }, `${floors.find((f) => f.level === a.floor).name} · ${formatArea(a.area)}`),
            h(
              'div',
              { className: 'compare__actions' },
              h('button', { type: 'button', className: 'btn btn--solid', disabled: a.status === 'sold', onClick: () => actions.selectApartment(a.id) }, 'View', h('span', { className: 'btn__arrow', 'aria-hidden': 'true' }, '→')),
              h('button', { type: 'button', className: 'compare__remove', 'aria-label': `Remove apartment ${a.number} from compare`, onClick: () => actions.toggleCompare(a.id) }, 'Remove'),
            ),
          ),
          ),
        ),
        ...ROWS.map((row) => {
          const winners = best(row);
          return h(
            'div',
            { className: 'compare__row', role: 'row' },
            h('div', { className: 'compare__label', role: 'rowheader' }, row.label),
            ...list.map((a) =>
              h(
                'div',
                { className: 'compare__cell', role: 'cell', 'data-best': winners.has(a.id) || null },
                row.show(a),
                winners.has(a.id) && h('span', { className: 'compare__best' }, row.best === 'min' ? 'Lowest' : 'Most'),
              ),
            ),
          );
        }),
        ids.length < COMPARE_MAX && h('p', { className: 'compare__hint', style: `grid-column: 1 / -1` }, `You can compare up to ${COMPARE_MAX} apartments. Add more from an apartment's details or the Filter results.`),
      ),
    );
  }

  function showView(v) {
    if (v === viewShown) return;
    viewShown = v;
    view.inert = !v;
    if (v) {
      returnFocus = document.activeElement;
      gsap.fromTo(view, { autoAlpha: 0, y: isMobile.matches ? 40 : 20 }, { autoAlpha: 1, y: 0, duration: 0.6, ease: 'expo.out' });
      table.scrollTo({ top: 0, left: 0 });
      view.querySelector('#compare-title').focus({ preventScroll: true });
    } else {
      gsap.to(view, { autoAlpha: 0, y: 20, duration: 0.35, ease: 'power2.in' });
      if (view.contains(document.activeElement)) (returnFocus?.isConnected ? returnFocus : openBtn).focus?.({ preventScroll: true });
    }
  }

  store.subscribe((st, p) => {
    if (st.compare !== p.compare) {
      renderTray(st.compare);
      if (st.compareOpen) renderView(st.compare);
    }
    if (st.compareOpen !== p.compareOpen) {
      if (st.compareOpen) renderView(st.compare);
      showView(st.compareOpen);
    }
    if (st.compare !== p.compare || st.compareOpen !== p.compareOpen) showTray(st.compare.length > 0 && !st.compareOpen);
  });
  renderTray(store.get().compare);

  return { tray, view };
}

function closeIcon() {
  const t = document.createElement('template');
  t.innerHTML = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 3l10 10M13 3L3 13"/></svg>';
  return t.content.firstElementChild;
}
