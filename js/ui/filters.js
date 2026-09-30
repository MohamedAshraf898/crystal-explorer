import gsap from 'gsap';
import { apartments, hasFilters, matchesFilters, ranges } from '../data/apartments.js';
import { flag, h, isMobile, render } from '../lib/dom.js';
import { bedsLabel, formatArea, formatMillions, formatPriceShort, pad2 } from '../lib/format.js';
import { statusIcon } from './status.js';

/**
 * Apartment finder — price and area filters.
 * Each filter has its own switch, so they work alone or together:
 * price only, area only, or both. Moving a slider switches its filter on.
 * The result list opens any apartment; the plan and floor list dim
 * everything that doesn't match (see planView / floorNav / floorPanel).
 */
const FILTERS = [
  { key: 'price', label: 'Price', step: 50000, bounds: ranges.price, format: (v) => formatMillions(v), unit: 'EGP' },
  { key: 'area', label: 'Area', step: 1, bounds: ranges.area, format: (v) => String(v), unit: 'm²' },
];

export function createFilters(store) {
  const { actions } = store;
  let open = false;
  // Slider positions are kept even while a filter is switched off.
  const values = Object.fromEntries(FILTERS.map((f) => [f.key, [...f.bounds]]));

  const count = h('span', { className: 'filter-btn__count', 'aria-hidden': 'true' });
  const button = h(
    'button',
    { type: 'button', className: 'filter-btn', 'aria-expanded': 'false', 'aria-controls': 'finder', onClick: () => setOpen(!open) },
    filterIcon(),
    h('span', { className: 'filter-btn__label' }, 'Filter'),
    count,
  );

  const summary = h('p', { className: 'finder__summary', 'aria-live': 'polite' });
  const results = h('ul', { className: 'finder__results', 'aria-label': 'Matching apartments' });
  const controls = FILTERS.map((f) => rangeControl(f));

  const panel = h(
    'aside',
    { id: 'finder', className: 'finder', role: 'dialog', 'aria-modal': 'false', 'aria-labelledby': 'finder-title', onKeydown: onKey },
    h(
      'header',
      { className: 'finder__head' },
      h('p', { className: 'eyebrow' }, 'Apartment finder'),
      h('h2', { id: 'finder-title', className: 'finder__title', tabindex: -1 }, 'Filter by price & area'),
      h('button', { type: 'button', className: 'icon-btn finder__close', 'aria-label': 'Close filters', onClick: () => setOpen(false) }, closeIcon()),
    ),
    h('div', { className: 'finder__controls' }, ...controls.map((c) => c.element)),
    h('div', { className: 'finder__bar' }, summary, h('button', { type: 'button', className: 'finder__reset', onClick: reset }, 'Reset')),
    results,
  );
  panel.inert = true;

  /* ── one filter: on/off switch + two-thumb range ─────────────────────── */
  function rangeControl(f) {
    const [lo, hi] = f.bounds;
    const toggle = h('input', { type: 'checkbox', role: 'switch', className: 'switch__input', id: `filter-${f.key}` });
    const readout = h('span', { className: 'range__readout' });
    const fill = h('span', { className: 'range__fill' });
    const thumb = (i) =>
      h('input', {
        type: 'range',
        className: 'range__input',
        min: lo,
        max: hi,
        step: f.step,
        value: values[f.key][i],
        'aria-label': `${f.label} ${i ? 'maximum' : 'minimum'}`,
      });
    const inputs = [thumb(0), thumb(1)];
    inputs.forEach((input, i) =>
      input.addEventListener('input', () => {
        let [a, b] = [Number(inputs[0].value), Number(inputs[1].value)];
        // thumbs can't cross
        if (a > b) i === 0 ? (a = b) : (b = a);
        inputs[0].value = a;
        inputs[1].value = b;
        values[f.key] = [a, b];
        toggle.checked = true;
        draw();
        commit();
      }),
    );
    toggle.addEventListener('change', commit);

    function draw() {
      const [a, b] = values[f.key];
      const pct = (v) => ((v - lo) / (hi - lo)) * 100;
      fill.style.left = `${pct(a)}%`;
      fill.style.right = `${100 - pct(b)}%`;
      readout.textContent = f.key === 'price' ? `${f.unit} ${f.format(a)} – ${f.format(b)}` : `${f.format(a)} – ${f.format(b)} ${f.unit}`;
      inputs.forEach((input, i) => input.setAttribute('aria-valuetext', `${f.unit === 'EGP' ? 'EGP ' : ''}${f.format(values[f.key][i])}${f.unit === 'm²' ? ' square metres' : ''}`));
    }
    function commit() {
      actions.setFilter(f.key, toggle.checked ? [...values[f.key]] : null);
    }
    function sync(range) {
      toggle.checked = Boolean(range);
      if (range) values[f.key] = [...range];
      inputs[0].value = values[f.key][0];
      inputs[1].value = values[f.key][1];
      draw();
    }
    draw();

    const element = h(
      'fieldset',
      { className: 'range', 'data-key': f.key },
      h(
        'legend',
        { className: 'range__head' },
        h('label', { className: 'switch', for: toggle.id }, toggle, h('span', { className: 'switch__track', 'aria-hidden': 'true' }), h('span', { className: 'switch__label' }, f.label)),
        readout,
      ),
      h('div', { className: 'range__track' }, fill, ...inputs),
      h('div', { className: 'range__ends', 'aria-hidden': 'true' }, h('span', {}, f.key === 'price' ? `${f.unit} ${f.format(lo)}` : `${lo} ${f.unit}`), h('span', {}, f.key === 'price' ? `${f.unit} ${f.format(hi)}` : `${hi} ${f.unit}`)),
    );
    return { element, sync, reset: () => ((values[f.key] = [lo, hi]), sync(null)) };
  }

  function reset() {
    controls.forEach((c) => c.reset());
    actions.clearFilters();
  }

  /* ── results ─────────────────────────────────────────────────────────── */
  function update(filters) {
    const active = hasFilters(filters);
    const list = apartments.filter((a) => matchesFilters(a, filters)).sort((a, b) => (a.price ?? Infinity) - (b.price ?? Infinity) || a.area - b.area);
    const n = [filters.price, filters.area].filter(Boolean).length;
    count.textContent = n ? String(n) : '';
    flag(button, 'active', active);
    button.setAttribute('aria-label', active ? `Filter apartments, ${n} filter${n > 1 ? 's' : ''} on, ${list.length} matching` : 'Filter apartments by price and area');
    summary.textContent = active ? `${list.length} of ${apartments.length} apartments match` : `All ${apartments.length} apartments`;
    render(
      results,
      list.length
        ? list.map((a) =>
            h(
              'li',
              {},
              h(
                'button',
                {
                  type: 'button',
                  className: 'result',
                  'data-status': a.status,
                  disabled: a.status === 'sold',
                  onClick: () => {
                    actions.selectApartment(a.id);
                    if (isMobile.matches) setOpen(false);
                  },
                },
                h('span', { className: 'result__id' }, `Apt ${pad2(a.number)}`, h('small', {}, `Floor ${pad2(a.floor)}`)),
                h('span', { className: 'result__spec' }, `${bedsLabel(a.layout.bedrooms)} · ${formatArea(a.area)}`),
                h('span', { className: 'result__price' }, formatPriceShort(a.price)),
                h('span', { className: 'result__status' }, statusIcon(a.status)),
              ),
            ),
          )
        : h('li', { className: 'finder__empty' }, 'No apartments match. Widen a range or switch a filter off.'),
    );
  }

  /* ── open / close ────────────────────────────────────────────────────── */
  function setOpen(v) {
    if (v === open) return;
    open = v;
    panel.inert = !v;
    button.setAttribute('aria-expanded', String(v));
    flag(button, 'open', v);
    const off = isMobile.matches ? { yPercent: 104, y: 0 } : { x: 24, y: 0 };
    if (v) {
      gsap.fromTo(panel, { autoAlpha: 0, ...off }, { autoAlpha: 1, x: 0, yPercent: 0, duration: 0.6, ease: 'expo.out' });
      panel.querySelector('#finder-title').focus({ preventScroll: true });
    } else {
      gsap.to(panel, { autoAlpha: 0, ...off, duration: 0.35, ease: 'power2.in' });
      if (panel.contains(document.activeElement)) button.focus({ preventScroll: true });
    }
  }

  function onKey(e) {
    if (e.key === 'Escape') {
      e.stopPropagation();
      setOpen(false);
    }
  }

  store.subscribe((st, p) => {
    if (st.filters !== p.filters) {
      update(st.filters);
      controls.forEach((c, i) => {
        const key = FILTERS[i].key;
        if (st.filters[key] !== p.filters[key]) c.sync(st.filters[key]);
      });
    }
  });
  update(store.get().filters);

  return { button, panel };
}

function filterIcon() {
  const t = document.createElement('template');
  t.innerHTML = '<svg class="filter-btn__icon" viewBox="0 0 16 16" aria-hidden="true"><path d="M2 4h12M4.5 8h7M7 12h2"/></svg>';
  return t.content.firstElementChild;
}

function closeIcon() {
  const t = document.createElement('template');
  t.innerHTML = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 3l10 10M13 3L3 13"/></svg>';
  return t.content.firstElementChild;
}
