import gsap from 'gsap';
import { floors, views } from '../data/project.js';
import { flag, h, isMobile, pointsAttr, s } from '../lib/dom.js';

/**
 * BUILDING VIEW — the real render with one invisible band per floor traced
 * on the photo. Hovering a band darkens everything except that floor.
 *
 * Performance: the photo is a plain <img> on its own GPU layer (its soft edges
 * are baked into the image's alpha channel), and the darkening is a separate
 * SVG whose *opacity* is animated. So hovering and zooming are compositor-only:
 * the photo is never re-rasterised, and there are no SVG masks or filters.
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

  /** @type {{ view: object, el: HTMLElement, zoom: HTMLElement, dim: SVGSVGElement, dimPath: SVGPathElement, bands: Map<number, SVGPolygonElement> } | null} */
  let layer = null;

  const useSmall = () => isMobile.matches || window.innerWidth < 1100;
  const backdropOf = (view) => view.image.replace(/\.webp$/, '-bg.webp');

  function buildLayer(view) {
    const vb = `0 0 ${view.width} ${view.height}`;
    const img = h('img', {
      className: 'photo__img',
      src: useSmall() ? view.imageSmall : view.image,
      alt: '',
      decoding: 'async',
      draggable: 'false',
    });
    const dimPath = s('path', { 'fill-rule': 'evenodd', d: dimD(view, null) });
    const dim = s('svg', { className: 'photo__dim', viewBox: vb, preserveAspectRatio: 'none' }, dimPath);
    const bands = new Map();
    const bandSvg = s('svg', { className: 'photo__bands', viewBox: vb, preserveAspectRatio: 'none' });
    for (const floor of floors) {
      const poly = s('polygon', { className: 'band', points: pointsAttr(bandPolygon(view, floor.level)), 'data-level': floor.level });
      bands.set(floor.level, poly);
      bandSvg.append(poly);
    }
    const zoom = h('div', { className: 'photo' }, img, dim, bandSvg);
    const el = h('div', { className: 'render' }, zoom);
    gsap.set(dim, { opacity: 0 });
    return { view, el, zoom, dim, dimPath, bands, img };
  }

  /** Dark overlay over the photo with the hovered floor cut out (even-odd fill, no SVG mask). */
  function dimD(view, level) {
    const outer = `M0,0H${view.width}V${view.height}H0Z`;
    if (level == null) return outer;
    const poly = bandPolygon(view, level);
    return `${outer}M${poly.map((p) => p.join(',')).join('L')}Z`;
  }

  /** Size the photo like object-fit: cover when the box is wider than the photo, contain otherwise. */
  function layout(l = layer) {
    if (!l) return;
    const box = l.el.getBoundingClientRect();
    const ar = l.view.width / l.view.height;
    const cover = !isMobile.matches && box.width / Math.max(1, box.height) >= ar;
    let w = box.width, hh = w / ar;
    if (cover ? hh < box.height : hh > box.height) {
      hh = box.height;
      w = hh * ar;
    }
    Object.assign(l.zoom.style, { width: `${w}px`, height: `${hh}px`, left: `${(box.width - w) / 2}px`, top: `${(box.height - hh) / 2}px` });
  }

  async function show(viewId, animate) {
    const view = views.find((v) => v.id === viewId) ?? views[0];
    const next = buildLayer(view);
    // Decode off the main thread before the swap, so the cross-fade never stutters.
    await next.img.decode().catch(() => {});
    backdrop.style.backgroundImage = `url(${backdropOf(view)})`;
    scroller.append(next.el);
    layout(next);
    const prev = layer;
    layer = next;
    if (prev && animate) {
      gsap.fromTo(next.el, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.9, ease: 'power2.inOut', onComplete: () => prev.el.remove() });
    } else prev?.el.remove();
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

  let resizeFrame = 0;
  window.addEventListener('resize', () => {
    cancelAnimationFrame(resizeFrame);
    resizeFrame = requestAnimationFrame(() => {
      layout();
      centerScroll();
    });
  });

  const ready = show(store.get().view, false);

  return {
    element: root,
    ready,
    show,
    get layer() {
      return layer;
    },
    /** Visual highlight of one floor (or none). */
    highlight(level) {
      if (!layer) return;
      layer.bands.forEach((band, l) => flag(band, 'active', l === level));
      if (level != null) layer.dimPath.setAttribute('d', dimD(layer.view, level));
    },
    /** Screen rectangle of a floor band (for the floating label). */
    bandRect(level) {
      return layer?.bands.get(level)?.getBoundingClientRect() ?? null;
    },
    /** Centre of a band as a CSS transform-origin (percent of the photo). */
    bandOrigin(level) {
      const poly = bandPolygon(layer.view, level);
      const xs = poly.map((p) => p[0]);
      const ys = poly.map((p) => p[1]);
      const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
      const cy = (Math.min(...ys) + Math.max(...ys)) / 2;
      return `${((cx / layer.view.width) * 100).toFixed(2)}% ${((cy / layer.view.height) * 100).toFixed(2)}%`;
    },
  };
}
