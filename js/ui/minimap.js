import gsap from 'gsap';
import { minimap as cfg } from '../data/project.js';
import { flag, h } from '../lib/dom.js';

/**
 * MINIMAP — a round, GTA-style map at the bottom of the floor page.
 * The building is always in the centre; highlighted places show as blips and
 * stick to the rim (pointing the way) when they're outside the circle.
 * The map image is local (assets/map), drawn from OpenStreetMap data.
 */

const ICONS = {
  mall: '<path d="M7 9V7a5 5 0 0 1 10 0v2"/><path d="M5 9h14l-1 11H6z"/>',
  promenade: '<path d="M3 15c2 0 2-2 4.5-2S10 15 12 15s2.5-2 4.5-2 2.5 2 4.5 2"/><path d="M3 19c2 0 2-2 4.5-2S10 19 12 19s2.5-2 4.5-2 2.5 2 4.5 2"/><path d="M12 11V4l5 3-5 3"/>',
  university: '<path d="M2 9l10-5 10 5-10 5z"/><path d="M6 11v5c3 2.5 9 2.5 12 0v-5"/>',
  hotel: '<path d="M3 20V6h11v14"/><path d="M14 10h7v10"/><path d="M6 9h2M10 9h1M6 13h2M10 13h1M6 17h2M10 17h1M17 14h1M17 17h1"/><path d="M2 20h20"/>',
  pin: '<path d="M12 21s-7-6.2-7-12a7 7 0 0 1 14 0c0 5.8-7 12-7 12z"/><circle cx="12" cy="9" r="2.5"/>',
};
const svgIcon = (body, cls) => {
  const t = document.createElement('template');
  t.innerHTML = `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true">${body}</svg>`;
  return t.content.firstElementChild;
};

/** Web Mercator: lat/lng → 0..1 on the map image. */
function project({ lat, lng }) {
  const merc = (la, ln) => [(ln + 180) / 360, (1 - Math.log(Math.tan((la * Math.PI) / 180) + 1 / Math.cos((la * Math.PI) / 180)) / Math.PI) / 2];
  const { south, north, west, east } = cfg.bounds;
  const [x0, y0] = merc(north, west), [x1, y1] = merc(south, east);
  const [x, y] = merc(lat, lng);
  return [(x - x0) / (x1 - x0), (y - y0) / (y1 - y0)];
}

/** Straight-line distance in km. */
function distanceKm(a, b) {
  const R = 6371, rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad, dLng = (b.lng - a.lng) * rad;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

export function createMinimap(store, { onOpen } = {}) {
  const mapKm = (cfg.bounds.east - cfg.bounds.west) * 111.32 * Math.cos((cfg.site.lat * Math.PI) / 180);
  const pxPerKm = cfg.width / mapKm; // image pixels per km
  const [sx, sy] = project(cfg.site);
  const rot = (cfg.rotate * Math.PI) / 180;
  const cos = Math.cos(rot), sin = Math.sin(rot);
  const state = { radius: cfg.radiusKm[cfg.start] };
  let step = cfg.start;

  const img = h('img', { className: 'minimap__img', alt: '', decoding: 'async', draggable: 'false' });
  const layer = h('div', { className: 'minimap__layer', style: `width:${cfg.width}px;height:${cfg.height}px;transform-origin:${sx * cfg.width}px ${sy * cfg.height}px` }, img);
  const disc = h('div', { className: 'minimap__disc' }, layer);
  const north = h('span', { className: 'minimap__north', 'aria-hidden': 'true' }, 'N');
  const scale = h('span', { className: 'minimap__scale', 'aria-hidden': 'true' });
  const center = h('span', { className: 'minimap__me', title: cfg.site.name }, h('span', { className: 'sr-only' }, cfg.site.name));

  // blips (buttons, so they can be focused / tapped to show their name)
  const blips = cfg.places.map((p) => {
    const km = distanceKm(cfg.site, p);
    const where = km < 0.05 ? `${cfg.site.name} is here` : `${km.toFixed(1)} km away`;
    const b = { place: p, km, where, pos: project(p) };
    b.el = h(
      'button',
      {
        type: 'button',
        className: `minimap__blip minimap__blip--${p.kind}${p.grow ? ' minimap__blip--grow' : ''}`,
        'aria-label': `${p.name}, ${where}`,
        // tap a place: open the full map with directions to it
        onClick: () => (onOpen ? onOpen(p.grow ? null : p.name) : select(selected === b ? null : b)),
        onMouseEnter: () => show(b),
        onMouseLeave: () => show(selected),
        onFocus: () => show(b),
        onBlur: () => show(selected),
      },
      svgIcon(ICONS[p.kind] ?? ICONS.pin, 'minimap__blip-icon'),
    );
    return b;
  });

  /* caption under the circle: the place you point at / tapped (GTA street-name style) */
  const capName = h('strong', {});
  const capMeta = h('small', {});
  const caption = h('p', { className: 'minimap__caption', 'aria-live': 'polite' }, capName, capMeta);
  let selected = null;
  function show(b) {
    blips.forEach((x) => flag(x.el, 'open', x === b));
    if (b) {
      capName.textContent = b.place.name;
      capMeta.textContent = b.where;
    } else {
      capName.textContent = cfg.site.name;
      capMeta.textContent = `${cfg.places.filter((p) => !p.grow).length} places nearby`;
    }
  }
  function select(b) {
    selected = b;
    show(b);
  }
  show(null);

  const zoomIn = h('button', { type: 'button', className: 'minimap__zoom', 'aria-label': 'Zoom map in', onClick: () => zoomTo(step - 1) }, '+');
  const zoomOut = h('button', { type: 'button', className: 'minimap__zoom', 'aria-label': 'Zoom map out', onClick: () => zoomTo(step + 1) }, '−');

  // the circle itself opens the full map
  const discBtn = h('button', { type: 'button', className: 'minimap__open-area', 'aria-label': 'Open the map with directions', onClick: () => onOpen?.() });
  const ring = h('div', { className: 'minimap__ring' }, disc, discBtn, center, north, ...blips.map((b) => b.el));
  const openBtn = h('button', { type: 'button', className: 'minimap__open', onClick: () => onOpen?.() }, svgIcon('<path d="M9 4L3 6v14l6-2 6 2 6-2V4l-6 2z"/><path d="M9 4v14M15 6v14"/>', 'minimap__open-icon'), 'Map & directions');
  const root = h(
    'section',
    { className: 'minimap', 'aria-label': `Area map around ${cfg.site.name}` },
    ring,
    caption,
    h('div', { className: 'minimap__bar' }, zoomIn, scale, zoomOut),
    onOpen && openBtn,
    h('p', { className: 'minimap__credit' }, cfg.credit),
  );
  root.inert = true;

  /** Rotate a map-image offset (px, from the site) into the circle's frame. */
  const turn = (dx, dy) => [dx * cos - dy * sin, dx * sin + dy * cos];

  function draw() {
    const R = disc.clientWidth / 2;
    if (!R) return;
    const s = R / (state.radius * pxPerKm); // screen px per image px
    layer.style.transform = `translate3d(${(R - sx * cfg.width).toFixed(1)}px, ${(R - sy * cfg.height).toFixed(1)}px, 0) rotate(${cfg.rotate}deg) scale(${s})`;
    // north marker sits on the rim, in the direction of north
    const [nx, ny] = turn(0, -1);
    north.style.transform = `translate(${(R + nx * (R + 1)).toFixed(1)}px, ${(R + ny * (R + 1)).toFixed(1)}px) translate(-50%, -50%)`;
    const max = R - 14;
    // "grow" places scale with the zoom (diameter in px ∝ 1 / radius)
    const grow = blips.filter((b) => b.place.grow);
    for (const b of grow) {
      const size = Math.min(R * 0.7, (R * 0.7 * cfg.radiusKm[0]) / state.radius);
      b.el.style.width = b.el.style.height = `${size.toFixed(1)}px`;
      b.el.style.setProperty('--icon', `${Math.max(0, Math.min(1, (size - 34) / 18))}`);
      const [x, y] = turn((b.pos[0] - sx) * cfg.width * s, (b.pos[1] - sy) * cfg.height * s);
      b.el.style.transform = `translate(${(R + x).toFixed(1)}px, ${(R + y).toFixed(1)}px) translate(-50%, -50%)`;
    }
    const pts = blips.filter((b) => !b.place.grow).map((b) => {
      let [x, y] = turn((b.pos[0] - sx) * cfg.width * s, (b.pos[1] - sy) * cfg.height * s);
      const d = Math.hypot(x, y);
      const edge = d > max;
      if (edge) [x, y] = [(x / d) * max, (y / d) * max];
      return { b, x, y, edge };
    });
    // nudge blips apart so icons never sit on top of each other
    const gap = blips[0]?.el.offsetWidth + 4 || 28;
    for (let pass = 0; pass < 6; pass++) {
      for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) {
        const a = pts[i], c = pts[j];
        let dx = c.x - a.x, dy = c.y - a.y;
        const d = Math.hypot(dx, dy) || 0.01;
        if (d >= gap) continue;
        const push = (gap - d) / 2;
        dx /= d; dy /= d;
        a.x -= dx * push; a.y -= dy * push;
        c.x += dx * push; c.y += dy * push;
      }
      for (const p of pts) {
        // never cover the building dot in the middle
        const c = Math.hypot(p.x, p.y), minC = gap * 0.85;
        if (c < minC) {
          const k = c > 0.01 ? minC / c : 1;
          [p.x, p.y] = c > 0.01 ? [p.x * k, p.y * k] : [minC, 0];
        }
        const d = Math.hypot(p.x, p.y);
        if (d > max) [p.x, p.y] = [(p.x / d) * max, (p.y / d) * max];
      }
    }
    for (const { b, x, y, edge } of pts) {
      flag(b.el, 'edge', edge);
      b.el.style.transform = `translate(${(R + x).toFixed(1)}px, ${(R + y).toFixed(1)}px) translate(-50%, -50%)`;
    }
    const r = cfg.radiusKm[step];
    scale.textContent = `${Number.isInteger(r) ? r : r.toFixed(1)} km`;
    zoomIn.disabled = step <= 0;
    zoomOut.disabled = step >= cfg.radiusKm.length - 1;
  }

  let tween = null;
  function zoomTo(i) {
    step = Math.max(0, Math.min(cfg.radiusKm.length - 1, i));
    tween?.kill();
    tween = gsap.to(state, { radius: cfg.radiusKm[step], duration: 0.55, ease: 'power3.out', onUpdate: draw });
    draw();
  }

  window.addEventListener('resize', () => requestAnimationFrame(draw));
  store.subscribe((st, p) => {
    if (st.viewMode === p.viewMode) return;
    const show = st.viewMode !== 'building';
    if (show === (p.viewMode !== 'building')) return;
    if (show && !img.src) img.src = cfg.image; // load on first use, not on the building page
    root.inert = !show;
    if (show) requestAnimationFrame(draw);
    gsap.to(root, { autoAlpha: show ? 1 : 0, y: show ? 0 : 12, duration: show ? 0.8 : 0.35, delay: show ? 1.1 : 0, ease: 'power3.out', overwrite: 'auto' });
  });
  gsap.set(root, { autoAlpha: 0, y: 12 });

  return root;
}
