import { apartmentsById, floorSummary } from '../data/apartments.js';
import { floors } from '../data/project.js';
import { flag, h, render } from '../lib/dom.js';
import { formatArea, pad2 } from '../lib/format.js';
import { statusBadge } from './status.js';

/**
 * Floating label for the hovered floor (on the photo) or apartment (on the
 * plan). Never blocks the pointer — except the touch "open" button.
 */
export function createTooltip(store, { building, plan }) {
  const inner = h('div', { className: 'tooltip__inner' });
  const root = h('div', { className: 'tooltip', role: 'tooltip' }, inner);
  const M = 12;

  const cta = (label, onClick) => h('button', { type: 'button', className: 'tooltip__cta', onClick }, label, h('span', { 'aria-hidden': 'true' }, '→'));

  function place() {
    const st = store.get();
    const w = root.offsetWidth, hh = root.offsetHeight;
    let x, y, side = 'right';
    if (st.viewMode === 'building' && st.hoveredFloor) {
      const r = building.bandRect(st.hoveredFloor);
      if (!r) return;
      x = Math.min(r.right, window.innerWidth) - w - 24;
      y = r.top + r.height / 2 - hh / 2;
      side = 'inside';
      if (window.innerWidth < 768) {
        x = window.innerWidth / 2 - w / 2;
        y = r.top - hh - 12;
        side = 'top';
      }
    } else if (st.viewMode !== 'building' && st.hoveredApartment && st.hoveredApartment !== st.selectedApartment) {
      const r = plan.polygonRect(st.hoveredApartment);
      if (!r) return;
      x = r.left + r.width / 2 - w / 2;
      y = r.top - hh - 12;
      side = 'top';
    } else return;
    x = Math.max(M, Math.min(window.innerWidth - w - M, x));
    y = Math.max(70, Math.min(window.innerHeight - hh - M, y));
    root.style.transform = `translate3d(${Math.round(x)}px, ${Math.round(y)}px, 0)`;
    root.dataset.side = side;
  }

  store.subscribe((st, p) => {
    if (st.hoveredFloor === p.hoveredFloor && st.hoveredApartment === p.hoveredApartment && st.viewMode === p.viewMode && st.selectedApartment === p.selectedApartment) return;
    const touch = st.hoverSource === 'touch';
    const floor = st.viewMode === 'building' && st.hoveredFloor ? floors.find((f) => f.level === st.hoveredFloor) : null;
    const apt = st.viewMode !== 'building' && st.hoveredApartment && st.hoveredApartment !== st.selectedApartment ? apartmentsById.get(st.hoveredApartment) : null;
    if (floor) {
      const sum = floorSummary(floor.level);
      render(
        inner,
        h('p', { className: 'tooltip__num' }, pad2(floor.level)),
        h('div', {}, h('p', { className: 'tooltip__title' }, floor.name), h('p', { className: 'tooltip__meta' }, `${sum.total} apartments · ${sum.minArea}–${formatArea(sum.maxArea)}`), touch && cta('Explore floor', () => store.actions.selectFloor(floor.level))),
      );
    } else if (apt) {
      render(
        inner,
        h('div', {}, h('p', { className: 'tooltip__title' }, `Apartment ${apt.number}`), h('p', { className: 'tooltip__meta' }, `${formatArea(apt.area)} · Floor ${pad2(apt.floor)}`), statusBadge(apt.status), touch && apt.status !== 'sold' && cta('View apartment', () => store.actions.selectApartment(apt.id))),
      );
    }
    flag(root, 'visible', Boolean(floor || apt));
    flag(root, 'touch', touch && Boolean(floor || apt));
    if (floor || apt) requestAnimationFrame(place);
  });
  window.addEventListener('resize', () => requestAnimationFrame(place));
  return root;
}
