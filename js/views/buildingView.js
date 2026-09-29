import gsap from 'gsap';
import { floors, views } from '../data/project.js';
import { flag, h, isMobile, pointsAttr, s } from '../lib/dom.js';

/**
 * BUILDING VIEW — the real render, full-bleed, with one invisible band per
 * floor traced on the photo. Hovering a band darkens the rest of the image
 * through an SVG mask (the hovered floor is "cut out" of the dark overlay),
 * so the highlight is the real facade, not a drawing.
 */

/** Traced polygon of a floor on a given view (image pixel coordinates). */
export function bandPolygon(view, level) {
  return view.floorBands[level - 1];
}

export function createBuildingView(store) {
  const root = h('div', { className: 'stage stage--building', 'aria-hidden': 'true' });
  const backdrop = h('div', { className: 'stage__backdrop' });
  // On phones the photo is shown larger than the screen and can be swiped sideways.
  const scroller = h('div', { className: 'render-scroller' });
  root.append(backdrop, scroller);

  /** @type {{ view: object, svg: SVGSVGElement, zoom: SVGGElement, dim: SVGRectElement, hole: SVGPolygonElement, bands: Map<number, SVGPolygonElement> } | null} */
  let layer = null;

  const useSmall = () => isMobile.matches || window.innerWidth < 1100;

  function buildLayer(view) {
    const id = `mask-${view.id}`;
    const hole = s('polygon', { className: 'band-hole', fill: 'black', points: '' });
    const dim = s('rect', { className: 'dim', width: view.width, height: view.height, mask: `url(#${id})`, opacity: 0 });
    const bands = new Map();
    const bandGroup = s('g', { className: 'bands' });
    for (const floor of floors) {
      const poly = s('polygon', {
        className: 'band',
        points: pointsAttr(bandPolygon(view, floor.level)),
        'data-level': floor.level,
      });
      bands.set(floor.level, poly);
      bandGroup.append(poly);
    }
    const zoom = s(
      'g',
      { className: 'zoom' },
      s(
        'g',
        { mask: `url(#${id}-edge)` },
        s('image', { href: useSmall() ? view.imageSmall : view.image, width: view.width, height: view.height, preserveAspectRatio: 'none' }),
        dim,
      ),
      bandGroup,
    );
    const svg = s(
      'svg',
      { className: 'render', viewBox: `0 0 ${view.width} ${view.height}`, preserveAspectRatio: fit(view) },
      s(
        'defs',
        {},
        s('mask', { id, maskUnits: 'userSpaceOnUse', x: 0, y: 0, width: view.width, height: view.height }, s('rect', { width: view.width, height: view.height, fill: 'white' }), hole),
        // Feathered photo edges so the render melts into the blurred backdrop.
        s('filter', { id: `${id}-feather`, x: '-10%', y: '-10%', width: '120%', height: '120%' }, s('feGaussianBlur', { stdDeviation: view.width * 0.012 })),
        s(
          'mask',
          { id: `${id}-edge`, maskUnits: 'userSpaceOnUse', x: 0, y: 0, width: view.width, height: view.height },
          s('rect', { x: view.width * 0.025, y: view.height * 0.04, width: view.width * 0.95, height: view.height * 0.92, fill: 'white', filter: `url(#${id}-feather)` }),
        ),
      ),
      zoom,
    );
    return { view, svg, zoom, dim, hole, bands };
  }

  /** Fill the screen when the screen is wider than the photo, otherwise show it whole over a blurred backdrop. */
  function fit(view) {
    if (isMobile.matches) return 'xMidYMid meet';
    const box = scroller.getBoundingClientRect();
    return box.width / Math.max(1, box.height) >= view.width / view.height ? 'xMidYMid slice' : 'xMidYMid meet';
  }

  function show(viewId, animate) {
    const view = views.find((v) => v.id === viewId) ?? views[0];
    const next = buildLayer(view);
    backdrop.style.backgroundImage = `url(${view.imageSmall})`;
    next.svg.style.setProperty('--aspect', String(view.width / view.height));
    scroller.append(next.svg);
    const prev = layer;
    layer = next;
    if (prev && animate) {
      gsap.fromTo(next.svg, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.9, ease: 'power2.inOut', onComplete: () => prev.svg.remove() });
    } else prev?.svg.remove();
    centerScroll();
  }

  function centerScroll() {
    requestAnimationFrame(() => (scroller.scrollLeft = (scroller.scrollWidth - scroller.clientWidth) / 2));
  }

  /* ── pointer interaction (mouse hover, click, touch tap) ─────────────── */
  let downAt = null;
  root.addEventListener('pointerdown', (e) => (downAt = { x: e.clientX, y: e.clientY, type: e.pointerType }));
  root.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse' || !store.get().ready) return;
    const band = e.target.closest?.('.band');
    store.actions.hoverFloor(band ? Number(band.dataset.level) : null, 'pointer');
  });
  root.addEventListener('pointerleave', (e) => {
    if (e.pointerType === 'mouse' && store.get().hoverSource === 'pointer') store.actions.hoverFloor(null);
  });
  root.addEventListener('click', (e) => {
    if (!store.get().ready || store.get().viewMode !== 'building') return;
    if (downAt && Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) > 10) return;
    const band = e.target.closest?.('.band');
    const pointerType = e.pointerType || downAt?.type || 'mouse';
    store.actions.pick(band ? { type: 'floor', level: Number(band.dataset.level) } : { type: 'empty' }, pointerType);
  });

  window.addEventListener('resize', () => {
    if (layer) layer.svg.setAttribute('preserveAspectRatio', fit(layer.view));
    centerScroll();
  });

  show(store.get().view, false);

  return {
    element: root,
    show,
    get layer() {
      return layer;
    },
    /** Visual highlight of one floor (or none). */
    highlight(level) {
      if (!layer) return;
      layer.bands.forEach((band, l) => flag(band, 'active', l === level));
      if (level != null) layer.hole.setAttribute('points', layer.bands.get(level).getAttribute('points'));
    },
    /** Screen rectangle of a floor band (for the floating label). */
    bandRect(level) {
      return layer?.bands.get(level)?.getBoundingClientRect() ?? null;
    },
    /** Centre of a band in image coordinates (zoom origin for the transition). */
    bandCenter(level) {
      const poly = bandPolygon(layer.view, level);
      const xs = poly.map((p) => p[0]);
      const ys = poly.map((p) => p[1]);
      return [(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2];
    },
  };
}
