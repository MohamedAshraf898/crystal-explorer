import gsap from 'gsap';
import { areaMap } from '../data/project.js';
import { h, isMobile } from '../lib/dom.js';

/**
 * AREA MAP — a still map of the neighbourhood behind the floor plans.
 * The image is part of the site (assets/map), drawn from OpenStreetMap data.
 *
 * It's turned (areaMap.rotate) around the building's real location, which
 * always sits under the centre of the plan. The + / − buttons zoom around
 * that point; zooming out stops before the edges of the map would show.
 */
/** Web Mercator: lat/lng → position on the map image (0..1). */
function project({ lat, lng }) {
  const merc = (la, ln) => [(ln + 180) / 360, (1 - Math.log(Math.tan((la * Math.PI) / 180) + 1 / Math.cos((la * Math.PI) / 180)) / Math.PI) / 2];
  const { south, north, west, east } = areaMap.bounds;
  const [x0, y0] = merc(north, west), [x1, y1] = merc(south, east);
  const [x, y] = merc(lat, lng);
  return [(x - x0) / (x1 - x0), (y - y0) / (y1 - y0)];
}

/** Width of the map image in km (at the site's latitude). */
const mapKm = () => (areaMap.bounds.east - areaMap.bounds.west) * 111.32 * Math.cos((areaMap.site.lat * Math.PI) / 180);

export function createMapBackground(store, plan) {
  const img = h('img', { className: 'map-bg__img', alt: '', decoding: 'async', draggable: 'false' });
  const labels = areaMap.labels.map((l) => {
    const [lx, ly] = project(l);
    return h(
      'span',
      {
        className: `map-bg__label map-bg__label--${l.kind}`,
        // upright labels turn back against the map rotation so they stay level
        style: `left:${(lx * 100).toFixed(2)}%;top:${(ly * 100).toFixed(2)}%;--r:${l.upright ? -areaMap.rotate : (l.rotate ?? 0)}deg`,
      },
      l.text,
    );
  });
  const [sx, sy] = project(areaMap.site);
  const layer = h('div', { className: 'map-bg__layer', style: `transform-origin:${sx * 100}% ${sy * 100}%` }, img, ...labels);
  const root = h('div', { className: 'map-bg', 'aria-hidden': 'true' }, layer, h('p', { className: 'map-bg__credit' }, areaMap.credit));

  /* ── zoom buttons ────────────────────────────────────────────────────── */
  const zoomIn = h('button', { type: 'button', className: 'map-zoom__btn', 'aria-label': 'Zoom map in', onClick: () => zoomBy(areaMap.zoom.step) }, '+');
  const zoomOut = h('button', { type: 'button', className: 'map-zoom__btn', 'aria-label': 'Zoom map out', onClick: () => zoomBy(1 / areaMap.zoom.step) }, '−');
  const controls = h('div', { className: 'map-zoom', role: 'group', 'aria-label': 'Map zoom' }, zoomIn, zoomOut);
  controls.inert = true;

  const svg = plan.element.querySelector('svg.plan');
  const scroller = plan.element.querySelector('.plan-scroller');
  const rad = (areaMap.rotate * Math.PI) / 180;
  const cos = Math.cos(rad), sin = Math.sin(rad);
  const state = { zoom: areaMap.zoom.start }; // multiplier on the plan-matched scale
  let limits = { min: 1, max: areaMap.zoom.max, base: 1 };

  /** Where the map's site point goes on screen, and the scale range that keeps the map covering the page. */
  function measure() {
    const view = root.getBoundingClientRect();
    const r = svg.getBoundingClientRect();
    if (!r.width || !view.width) return null;
    const { width: W, height: H } = areaMap;
    const cx = r.left + r.width / 2 - view.left;
    const cy = r.top + r.height / 2 - view.top;
    // scale at zoom 1: the drawn plan spans `planKm` of map
    const planW = Math.min(r.width, r.height * plan.contentAspect() || r.width);
    const base = planW / (W * (areaMap.planKm / mapKm()));
    // smallest scale at which every page corner is still on the (rotated) map
    let cover = 0;
    for (const [px, py] of [[0, 0], [view.width, 0], [0, view.height], [view.width, view.height]]) {
      const dx = px - cx, dy = py - cy;
      const u = dx * cos + dy * sin; // corner in the map's own (unrotated) axes
      const v = -dx * sin + dy * cos;
      cover = Math.max(cover, u > 0 ? u / ((1 - sx) * W) : -u / (sx * W), v > 0 ? v / ((1 - sy) * H) : -v / (sy * H));
    }
    return { cx, cy, base, cover };
  }

  function place() {
    const m = measure();
    if (!m) return;
    const { width: W, height: H } = areaMap;
    const cover = m.cover / m.base; // below this the map's edge would show
    limits = { base: m.base, min: Math.max(areaMap.zoom.min, cover), max: Math.max(areaMap.zoom.max, cover * 1.5) };
    state.zoom = Math.min(limits.max, Math.max(limits.min, state.zoom));
    const s = m.base * state.zoom;
    layer.style.width = `${W * s}px`;
    layer.style.height = `${H * s}px`;
    layer.style.transform = `translate3d(${(m.cx - sx * W * s).toFixed(1)}px, ${(m.cy - sy * H * s).toFixed(1)}px, 0) rotate(${areaMap.rotate}deg)`;
    zoomIn.disabled = state.zoom >= limits.max - 1e-3;
    zoomOut.disabled = state.zoom <= limits.min + 1e-3;
  }

  let tween = null;
  function zoomBy(f) {
    const target = Math.min(limits.max, Math.max(limits.min, state.zoom * f));
    tween?.kill();
    tween = gsap.to(state, { zoom: target, duration: 0.6, ease: 'power3.out', onUpdate: place });
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
    if (show) {
      // load the map the first time a floor opens (not on the building page)
      if (!img.src) img.src = isMobile.matches ? areaMap.imageSmall : areaMap.image;
      requestAnimationFrame(() => requestAnimationFrame(place)); // after the plan has its size
    }
    if (show !== (p.viewMode !== 'building')) {
      controls.inert = !show;
      gsap.to([root, controls], { autoAlpha: show ? 1 : 0, duration: show ? 1.2 : 0.5, delay: show ? 0.6 : 0, ease: 'power2.out', overwrite: 'auto' });
    }
  });
  gsap.set([root, controls], { autoAlpha: 0 });

  return { element: root, controls, place };
}
