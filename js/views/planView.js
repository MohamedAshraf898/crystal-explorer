import gsap from 'gsap';
import { apartmentsByFloor } from '../data/apartments.js';
import { floors } from '../data/project.js';
import { plans } from '../data/plans.js';
import { flag, h, isMobile, pointsAttr, s } from '../lib/dom.js';

/**
 * PLAN VIEW — the architect's floor plan with every apartment outlined as an
 * interactive polygon (outlines were extracted from the drawing itself).
 * Hover / tap highlights a unit and darkens the rest through a mask;
 * selecting a unit animates the SVG viewBox into it like a camera move.
 */
export function createPlanView(store) {
  const root = h('div', { className: 'stage stage--plan' });
  const scroller = h('div', { className: 'plan-scroller' });
  root.append(scroller);

  const image = s('image', { className: 'plan-image', preserveAspectRatio: 'none' });
  const hole = s('polygon', { fill: 'black', points: '' });
  const dim = s('rect', { className: 'plan-dim', mask: 'url(#plan-mask)', opacity: 0 });
  const maskRect = s('rect', { fill: 'white' });
  const units = s('g', { className: 'units' });
  const mask = s('mask', { id: 'plan-mask', maskUnits: 'userSpaceOnUse', x: 0, y: 0 }, maskRect, hole);
  const outline = s('polygon', { className: 'unit-outline', points: '' });
  const svg = s(
    'svg',
    { className: 'plan', preserveAspectRatio: 'xMidYMid meet', role: 'img' },
    s(
      'defs',
      {},
      mask,
      s('pattern', { id: 'hatch-reserved', width: 26, height: 26, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(45)' }, s('line', { x1: 0, y1: 0, x2: 0, y2: 26, className: 'hatch-line' })),
      s(
        'pattern',
        { id: 'hatch-sold', width: 22, height: 22, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(45)' },
        s('line', { x1: 0, y1: 0, x2: 0, y2: 22, className: 'hatch-line hatch-line--sold' }),
        s('line', { x1: 0, y1: 0, x2: 22, y2: 0, className: 'hatch-line hatch-line--sold' }),
      ),
    ),
    image,
    units,
    dim,
    outline,
  );
  scroller.append(svg);

  let planId = null;
  let floorLevel = null;
  const polygons = new Map();
  const vb = { x: 0, y: 0, w: 1, h: 1 };
  const applyViewBox = () => svg.setAttribute('viewBox', `${vb.x} ${vb.y} ${vb.w} ${vb.h}`);

  /** Show the plan of a floor (re-uses the image when two floors share a plan). */
  function setFloor(level) {
    const floor = floors.find((f) => f.level === level);
    if (!floor) return;
    floorLevel = level;
    const plan = plans[floor.plan];
    if (planId !== floor.plan) {
      planId = floor.plan;
      image.setAttribute('href', isMobile.matches ? plan.imageSmall : plan.image);
      image.setAttribute('width', plan.width);
      image.setAttribute('height', plan.height);
      for (const el of [maskRect, dim, mask]) {
        el.setAttribute('width', plan.width);
        el.setAttribute('height', plan.height);
      }
    }
    // Units of THIS floor (statuses differ between floors sharing a plan).
    units.replaceChildren();
    polygons.clear();
    for (const apt of apartmentsByFloor.get(level)) {
      const poly = s('polygon', {
        className: 'unit',
        points: pointsAttr(apt.unit.poly),
        'data-id': apt.id,
        'data-status': apt.status,
      });
      polygons.set(apt.id, poly);
      units.append(poly);
    }
    svg.setAttribute('aria-label', `Floor plan, ${floor.name}`);
    Object.assign(vb, contentBox(plan));
    applyViewBox();
    highlight(null);
    gsap.set(dim, { opacity: 0 });
    centerScroll();
  }

  /** Phones: the plan is wider than the screen — start centred. */
  function centerScroll() {
    requestAnimationFrame(() => (scroller.scrollLeft = (scroller.scrollWidth - scroller.clientWidth) / 2));
  }

  const contentBox = (plan) => {
    const [x, y, w, hh] = plan.content;
    return { x, y, w, h: hh };
  };

  /** A viewBox framing one apartment, matching the stage aspect ratio. */
  function unitBox(id) {
    const apt = apartmentsByFloor.get(floorLevel).find((a) => a.id === id);
    const xs = apt.unit.poly.map((p) => p[0]);
    const ys = apt.unit.poly.map((p) => p[1]);
    const bx = Math.min(...xs), by = Math.min(...ys);
    const bw = Math.max(...xs) - bx, bh = Math.max(...ys) - by;
    const rect = root.getBoundingClientRect();
    const aspect = rect.width / Math.max(1, rect.height);
    let w = Math.max(bw, bh * aspect) * 2.1;
    let hh = w / aspect;
    return { x: bx + bw / 2 - w / 2, y: by + bh / 2 - hh / 2, w, h: hh };
  }

  function highlight(id) {
    polygons.forEach((poly, key) => flag(poly, 'active', key === id));
    const points = id ? polygons.get(id)?.getAttribute('points') ?? '' : '';
    if (points) hole.setAttribute('points', points);
    outline.setAttribute('points', points);
  }

  /* ── pointer interaction ─────────────────────────────────────────────── */
  let downAt = null;
  root.addEventListener('pointerdown', (e) => (downAt = { x: e.clientX, y: e.clientY, type: e.pointerType }));
  root.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') return;
    const unit = e.target.closest?.('.unit');
    store.actions.hoverApartment(unit ? unit.dataset.id : null, 'pointer');
  });
  root.addEventListener('pointerleave', (e) => {
    if (e.pointerType === 'mouse' && store.get().hoverSource === 'pointer') store.actions.hoverApartment(null);
  });
  root.addEventListener('click', (e) => {
    if (store.get().viewMode === 'building') return;
    if (downAt && Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) > 10) return;
    const unit = e.target.closest?.('.unit');
    const pointerType = e.pointerType || downAt?.type || 'mouse';
    store.actions.pick(unit ? { type: 'apartment', id: unit.dataset.id } : { type: 'empty' }, pointerType);
  });

  return {
    element: root,
    setFloor,
    highlight,
    centerScroll,
    dim,
    viewBox: vb,
    applyViewBox,
    contentBox: () => contentBox(plans[planId]),
    unitBox,
    polygonRect(id) {
      return polygons.get(id)?.getBoundingClientRect() ?? null;
    },
    get floor() {
      return floorLevel;
    },
  };
}
