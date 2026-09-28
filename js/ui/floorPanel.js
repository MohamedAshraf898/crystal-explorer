import gsap from 'gsap';
import { apartmentsByFloor, floorSummary } from '../data/apartments.js';
import { floors } from '../data/project.js';
import { flag, h, isMobile, render } from '../lib/dom.js';
import { formatArea, pad2 } from '../lib/format.js';
import { statusIcon } from './status.js';

/**
 * Floor overview + accessible apartment list. Hover/focus a row highlights the
 * apartment on the plan; click opens it (same actions as the plan).
 */
export function createFloorPanel(store) {
  const { actions } = store;
  const root = h('aside', { className: 'floor-panel' });
  root.inert = true;
  const rows = new Map();
  let visible = false;
  const clearUi = () => {
    if (store.get().hoverSource === 'ui') actions.hoverApartment(null);
  };

  function build(level) {
    const floor = floors.find((f) => f.level === level);
    const sum = floorSummary(level);
    rows.clear();
    root.setAttribute('aria-label', `${floor.name} apartments`);
    const stat = (k, v) => h('div', {}, h('dt', {}, k), h('dd', {}, v));
    render(
      root,
      h(
        'header',
        { className: 'floor-panel__head' },
        h('p', { className: 'eyebrow' }, `Level ${pad2(level)}`),
        h('h2', { className: 'floor-panel__title' }, floor.name),
        h('dl', { className: 'floor-panel__stats' }, stat('Apartments', String(sum.total)), stat('Available', String(sum.available)), stat('Sizes', `${sum.minArea}–${formatArea(sum.maxArea)}`)),
      ),
      h(
        'ul',
        { className: 'unit-list', 'aria-label': `Apartments on ${floor.name}` },
        ...apartmentsByFloor.get(level).map((apt) => {
          const row = h(
            'button',
            {
              type: 'button',
              className: 'unit-row',
              'data-status': apt.status,
              disabled: apt.status === 'sold',
              'aria-label': `Apartment ${apt.number}, ${apt.area} square metres, ${apt.status}`,
              onClick: () => actions.selectApartment(apt.id),
              onMouseEnter: () => actions.hoverApartment(apt.id, 'ui'),
              onMouseLeave: clearUi,
              onFocus: () => actions.hoverApartment(apt.id, 'ui'),
              onBlur: clearUi,
            },
            h('span', { className: 'unit-row__id' }, `Apt ${pad2(apt.number)}`),
            h('span', { className: 'unit-row__area' }, formatArea(apt.area)),
            h('span', { className: 'unit-row__status' }, statusIcon(apt.status)),
          );
          rows.set(apt.id, row);
          return h('li', {}, row);
        }),
      ),
      h('p', { className: 'floor-panel__hint' }, isMobile.matches ? 'Tap an apartment on the plan, or pick one here' : 'Select an apartment on the plan or from the list'),
    );
  }

  function setVisible(v) {
    if (v === visible) return;
    visible = v;
    root.inert = !v;
    const off = isMobile.matches ? { y: 40 } : { x: 30 };
    if (v) gsap.fromTo(root, { autoAlpha: 0, ...off }, { autoAlpha: 1, x: 0, y: 0, duration: 0.8, ease: 'power3.out', delay: 0.9 });
    else gsap.to(root, { autoAlpha: 0, ...off, duration: 0.35, ease: 'power2.in' });
  }

  store.subscribe((st, p) => {
    if (st.selectedFloor && st.selectedFloor !== p.selectedFloor) build(st.selectedFloor);
    if (st.hoveredApartment !== p.hoveredApartment) rows.forEach((r, id) => flag(r, 'hovered', id === st.hoveredApartment));
    if (st.viewMode !== p.viewMode) {
      if (st.viewMode === 'floor' && p.viewMode === 'apartment') {
        visible = false; // re-enter quickly without the long delay
        root.inert = false;
        visible = true;
        gsap.fromTo(root, { autoAlpha: 0 }, { autoAlpha: 1, x: 0, y: 0, duration: 0.6, ease: 'power3.out', delay: 0.3 });
      } else setVisible(st.viewMode === 'floor');
    }
  });
  return root;
}
