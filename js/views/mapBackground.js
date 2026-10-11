import gsap from 'gsap';
import { areaMap } from '../data/project.js';
import { h, isMobile } from '../lib/dom.js';

/**
 * AREA MAP — a still map of the neighbourhood behind the floor plans.
 * The image is part of the site (assets/map), drawn from OpenStreetMap data.
 * It's positioned so the building's real location sits under the plan, and
 * follows the plan when it's scrolled sideways on phones.
 */
export function createMapBackground(store, plan) {
  const img = h('img', { className: 'map-bg__img', src: isMobile.matches ? areaMap.imageSmall : areaMap.image, alt: '', decoding: 'async', draggable: 'false' });
  const labels = areaMap.labels.map((l) =>
    h('span', { className: `map-bg__label map-bg__label--${l.kind}`, style: `left:${l.x}%;top:${l.y}%;--r:${l.rotate ?? 0}deg` }, l.text),
  );
  const layer = h('div', { className: 'map-bg__layer' }, img, ...labels);
  const root = h('div', { className: 'map-bg', 'aria-hidden': 'true' }, layer, h('p', { className: 'map-bg__credit' }, areaMap.credit));

  const svg = plan.element.querySelector('svg.plan');
  const scroller = plan.element.querySelector('.plan-scroller');

  /** Scale + move the map so the site point is under the centre of the plan drawing. */
  function place() {
    const view = root.getBoundingClientRect();
    const r = svg.getBoundingClientRect();
    if (!r.width || !view.width) return;
    const { width: W, height: H } = areaMap;
    const [sx, sy] = areaMap.site.map((v) => v / 100);
    const cx = r.left + r.width / 2 - view.left;
    const cy = r.top + r.height / 2 - view.top;
    // zoom: the plan covers `planShare` of the map width (uses the drawn plan size, not the scroller)
    const planW = Math.min(r.width, (r.height * plan.contentAspect()) || r.width);
    let s = planW / (W * areaMap.planShare);
    // …but the map must always cover the whole page around that point
    s = Math.max(s, cx / (sx * W), (view.width - cx) / ((1 - sx) * W), cy / (sy * H), (view.height - cy) / ((1 - sy) * H));
    layer.style.width = `${W * s}px`;
    layer.style.height = `${H * s}px`;
    layer.style.transform = `translate3d(${Math.round(cx - sx * W * s)}px, ${Math.round(cy - sy * H * s)}px, 0)`;
  }

  let frame = 0;
  const schedule = () => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(place);
  };
  window.addEventListener('resize', schedule);
  scroller.addEventListener('scroll', schedule, { passive: true });

  store.subscribe((st, p) => {
    if (st.viewMode === p.viewMode && st.selectedFloor === p.selectedFloor) return;
    const show = st.viewMode !== 'building';
    if (show) requestAnimationFrame(() => requestAnimationFrame(place)); // after the plan has its size
    if (show !== (p.viewMode !== 'building')) gsap.to(root, { autoAlpha: show ? 1 : 0, duration: show ? 1.2 : 0.6, delay: show ? 0.6 : 0, ease: 'power2.out', overwrite: 'auto' });
  });
  gsap.set(root, { autoAlpha: 0 });

  return { element: root, place };
}
