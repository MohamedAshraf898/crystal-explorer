import gsap from 'gsap';
import { apartmentsById, floorSummary } from '../data/apartments.js';
import { floors, project } from '../data/project.js';
import { h, isTouch } from '../lib/dom.js';
import { formatArea, statusLabel } from '../lib/format.js';

/** Contextual back: apartment → floor → building (same as Esc). */
export function createBackButton(store) {
  const label = h('span');
  const btn = h('button', { type: 'button', className: 'back-btn', onClick: () => store.actions.back() }, h('span', { className: 'back-btn__arrow', 'aria-hidden': 'true' }, '←'), label);
  btn.inert = true;
  let shown = false;
  store.subscribe((st) => {
    const floor = floors.find((f) => f.level === st.selectedFloor);
    if (st.viewMode !== 'building') {
      const text = st.viewMode === 'apartment' && floor ? `Back to ${floor.name}` : 'Back to building';
      label.textContent = text;
      btn.setAttribute('aria-label', text);
    }
    const want = st.viewMode !== 'building';
    if (want === shown) return;
    shown = want;
    btn.inert = !want;
    if (want) gsap.fromTo(btn, { autoAlpha: 0, x: -12 }, { autoAlpha: 1, x: 0, duration: 0.7, ease: 'power3.out', delay: 1 });
    else gsap.to(btn, { autoAlpha: 0, x: -12, duration: 0.3, ease: 'power2.in' });
  });
  return btn;
}

export function createHint(store) {
  const el = h('p', { className: 'hint', 'aria-hidden': 'true', hidden: true });
  const update = () => {
    const st = store.get();
    el.textContent = isTouch.matches ? 'Tap a floor to preview · Tap again to explore' : 'Hover a floor to preview · Click to explore';
    el.hidden = !(st.ready && st.viewMode === 'building');
  };
  store.subscribe((st, p) => {
    if (st.ready !== p.ready || st.viewMode !== p.viewMode) update();
  });
  return el;
}

export function createLiveRegion(store) {
  const el = h('p', { className: 'sr-only', 'aria-live': 'polite' });
  store.subscribe((st, p) => {
    if (st.viewMode === p.viewMode && st.selectedFloor === p.selectedFloor && st.selectedApartment === p.selectedApartment) return;
    const floor = floors.find((f) => f.level === st.selectedFloor);
    const apt = apartmentsById.get(st.selectedApartment);
    if (st.viewMode === 'apartment' && apt) el.textContent = `Apartment ${apt.number}, ${formatArea(apt.area)}, ${statusLabel[apt.status]}.`;
    else if (st.viewMode === 'floor' && floor) {
      const sum = floorSummary(floor.level);
      el.textContent = `${floor.name} opened. ${sum.total} apartments, ${sum.available} available.`;
    } else el.textContent = 'Building overview.';
  });
  return el;
}

/** Brand loading screen with real preload progress. */
export function createLoader() {
  const bar = h('span');
  const count = h('span', { className: 'loader__count' }, '000');
  const content = h(
    'div',
    { className: 'loader__content' },
    h('img', { className: 'loader__logo', src: 'assets/brand/crystal-white.png', alt: '', width: 441, height: 420 }),
    h('div', { className: 'loader__bar' }, bar),
    h('div', { className: 'loader__row' }, h('span', {}, `${project.developer}`), count),
  );
  const root = h('div', { className: 'loader', role: 'progressbar', 'aria-label': `Loading ${project.name} ${project.location}`, 'aria-valuemin': 0, 'aria-valuemax': 100 }, content);
  const shown = { v: 0 };
  const draw = () => {
    bar.style.transform = `scaleX(${shown.v / 100})`;
    count.textContent = String(Math.round(shown.v)).padStart(3, '0');
    root.setAttribute('aria-valuenow', String(Math.round(shown.v)));
  };
  return {
    element: root,
    progress(p) {
      gsap.to(shown, { v: p, duration: 0.5, ease: 'power2.out', onUpdate: draw, overwrite: 'auto' });
    },
    done() {
      return new Promise((resolve) => {
        gsap
          .timeline({ onComplete: () => (root.remove(), resolve()) })
          .to(shown, { v: 100, duration: 0.4, onUpdate: draw })
          .to(content, { autoAlpha: 0, y: -10, duration: 0.5, ease: 'power2.in' }, '+=0.15')
          .to(root, { autoAlpha: 0, duration: 0.9, ease: 'power2.inOut' }, '-=0.1');
        setTimeout(resolve, 1200); // start the intro while the curtain lifts
      });
    },
  };
}
