import gsap from 'gsap';
import { minimap as cfg } from '../data/project.js';
import { flag, h, isMobile, render } from '../lib/dom.js';
import { formatDistance, formatDuration, loadRoads, route } from '../lib/router.js';

/**
 * MAP VIEW — full-screen area map inside the site, with driving directions.
 * Opens from the minimap. Drag / pinch / wheel to move and zoom; pick where
 * you're going (or start from your own location) and the route, distance,
 * time and turn-by-turn steps are worked out in the browser from local
 * OpenStreetMap road data — nothing is sent to Google or any map service.
 */

const MAP_W = 8000, MAP_H = 7104, COLS = 4, ROWS = 4; // assets/map/tiles/{row}-{col}.webp
const ICONS = {
  mall: '<path d="M7 9V7a5 5 0 0 1 10 0v2"/><path d="M5 9h14l-1 11H6z"/>',
  promenade: '<path d="M3 15c2 0 2-2 4.5-2S10 15 12 15s2.5-2 4.5-2 2.5 2 4.5 2"/><path d="M3 19c2 0 2-2 4.5-2S10 19 12 19s2.5-2 4.5-2 2.5 2 4.5 2"/><path d="M12 11V4l5 3-5 3"/>',
  university: '<path d="M2 9l10-5 10 5-10 5z"/><path d="M6 11v5c3 2.5 9 2.5 12 0v-5"/>',
  hotel: '<path d="M3 20V6h11v14"/><path d="M14 10h7v10"/><path d="M6 9h2M10 9h1M6 13h2M10 13h1M6 17h2M10 17h1M17 14h1M17 17h1"/><path d="M2 20h20"/>',
  pin: '<path d="M12 21s-7-6.2-7-12a7 7 0 0 1 14 0c0 5.8-7 12-7 12z"/><circle cx="12" cy="9" r="2.5"/>',
};
const TURN_ICON = {
  start: '<circle cx="12" cy="12" r="4"/>',
  arrive: '<path d="M12 21s-6-5.4-6-10.5a6 6 0 0 1 12 0C18 15.6 12 21 12 21z"/><circle cx="12" cy="10.5" r="2"/>',
  straight: '<path d="M12 20V4M6 10l6-6 6 6"/>',
  left: '<path d="M18 20v-7a4 4 0 0 0-4-4H5M10 4L5 9l5 5"/>',
  right: '<path d="M6 20v-7a4 4 0 0 1 4-4h9M14 4l5 5-5 5"/>',
  'u-turn': '<path d="M8 20V9a4 4 0 0 1 8 0v4M12 10l4 4 4-4"/>',
};
const svg = (body, cls) => {
  const t = document.createElement('template');
  t.innerHTML = `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true">${body}</svg>`;
  return t.content.firstElementChild;
};
const turnIcon = (turn) => TURN_ICON[turn.includes('u-turn') ? 'u-turn' : turn.includes('left') ? 'left' : turn.includes('right') ? 'right' : turn in TURN_ICON ? turn : 'straight'];

/** lat/lng → map pixels (Web Mercator, same projection as the map image). */
function toMap({ lat, lng }) {
  const merc = (la, ln) => [(ln + 180) / 360, (1 - Math.log(Math.tan((la * Math.PI) / 180) + 1 / Math.cos((la * Math.PI) / 180)) / Math.PI) / 2];
  const { south, north, west, east } = cfg.bounds;
  const [x0, y0] = merc(north, west), [x1, y1] = merc(south, east);
  const [x, y] = merc(lat, lng);
  return [((x - x0) / (x1 - x0)) * MAP_W, ((y - y0) / (y1 - y0)) * MAP_H];
}

export function createMapView() {
  const rot = (cfg.rotate * Math.PI) / 180;
  const cos = Math.cos(rot), sin = Math.sin(rot);
  const site = { id: 'site', name: cfg.site.name, kind: 'site', xy: toMap(cfg.site) };
  const places = cfg.places.filter((p) => !p.grow).map((p, i) => ({ id: `p${i}`, name: p.name, kind: p.kind, xy: toMap(p) }));
  const byId = new Map([site, ...places].map((p) => [p.id, p]));
  const view = { x: site.xy[0], y: site.xy[1], s: 0.3 }; // map point at the centre of the visible area, scale
  const state = { from: 'site', to: places[0]?.id ?? null, me: null, result: null, open: false };

  /* ── map stage ───────────────────────────────────────────────────────── */
  const tiles = [];
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      tiles.push(h('img', { className: 'mapview__tile', alt: '', draggable: 'false', decoding: 'async', 'data-src': `assets/map/tiles/${r}-${c}.webp`, style: `left:${(c * MAP_W) / COLS}px;top:${(r * MAP_H) / ROWS}px;width:${MAP_W / COLS}px;height:${MAP_H / ROWS}px` }));
  const routeCasing = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
  const routeLine = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
  const routeLinks = document.createElementNS('http://www.w3.org/2000/svg', 'path'); // dashed bits from a place to its road
  routeCasing.setAttribute('class', 'mapview__route-casing');
  routeLine.setAttribute('class', 'mapview__route');
  routeLinks.setAttribute('class', 'mapview__route-link');
  const routeSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  routeSvg.setAttribute('class', 'mapview__routes');
  routeSvg.setAttribute('viewBox', `0 0 ${MAP_W} ${MAP_H}`);
  routeSvg.append(routeCasing, routeLinks, routeLine);
  const world = h('div', { className: 'mapview__world', style: `width:${MAP_W}px;height:${MAP_H}px` }, ...tiles, routeSvg);

  const markerEls = new Map();
  const markerLayer = h('div', { className: 'mapview__markers' });
  function marker(p) {
    const el =
      p.kind === 'site'
        ? h('button', { type: 'button', className: 'mapview__marker mapview__marker--site', 'aria-label': p.name, onClick: () => setEnd('to', p.id) }, h('span', { className: 'mapview__dot' }), h('span', { className: 'mapview__tag' }, p.name))
        : p.kind === 'me'
          ? h('span', { className: 'mapview__marker mapview__marker--me', 'aria-hidden': 'true' }, h('span', { className: 'mapview__me' }))
          : h('button', { type: 'button', className: 'mapview__marker', 'aria-label': `${p.name}: show directions`, onClick: () => setEnd('to', p.id) }, h('span', { className: 'mapview__pin' }, svg(ICONS[p.kind] ?? ICONS.pin, 'mapview__pin-icon')), h('span', { className: 'mapview__tag' }, p.name));
    markerEls.set(p.id, el);
    markerLayer.append(el);
  }
  [...places, site].forEach(marker);

  const stage = h('div', { className: 'mapview__stage' }, world, markerLayer);
  const zoomIn = h('button', { type: 'button', className: 'mapview__ctl', 'aria-label': 'Zoom in', onClick: () => zoomBy(1.6) }, '+');
  const zoomOut = h('button', { type: 'button', className: 'mapview__ctl', 'aria-label': 'Zoom out', onClick: () => zoomBy(1 / 1.6) }, '−');
  const recenter = h('button', { type: 'button', className: 'mapview__ctl mapview__ctl--icon', 'aria-label': 'Show the whole route', onClick: () => fit(true) }, svg('<circle cx="12" cy="12" r="3"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4"/>', 'mapview__ctl-icon'));
  const controls = h('div', { className: 'mapview__controls' }, zoomIn, zoomOut, recenter);

  /* ── directions panel ────────────────────────────────────────────────── */
  const option = (p) => h('option', { value: p.id }, p.name);
  const fromSel = h('select', { className: 'mapview__select', 'aria-label': 'From', onChange: (e) => setEnd('from', e.target.value) });
  const toSel = h('select', { className: 'mapview__select', 'aria-label': 'To', onChange: (e) => setEnd('to', e.target.value) });
  const fillSelects = () => {
    const all = [site, ...places];
    render(fromSel, h('option', { value: 'me' }, 'My location'), ...all.map(option));
    render(toSel, ...all.map(option));
    fromSel.value = state.from;
    toSel.value = state.to;
  };
  const swap = h('button', { type: 'button', className: 'mapview__swap', 'aria-label': 'Swap start and destination', onClick: swapEnds }, svg('<path d="M7 4v16M3 8l4-4 4 4M17 20V4M13 16l4 4 4-4"/>', 'mapview__swap-icon'));
  const summary = h('div', { className: 'mapview__summary', 'aria-live': 'polite' });
  const steps = h('ol', { className: 'mapview__steps' });
  const quick = h(
    'div',
    { className: 'mapview__quick', role: 'group', 'aria-label': 'Nearby places' },
    ...places.map((p) => h('button', { type: 'button', className: 'mapview__chip', 'data-id': p.id, onClick: () => setEnd('to', p.id) }, svg(ICONS[p.kind] ?? ICONS.pin, 'mapview__chip-icon'), p.name)),
  );
  const close = h('button', { type: 'button', className: 'icon-btn mapview__close', 'aria-label': 'Close map', onClick: () => setOpen(false) }, svg('<path d="M5 5l14 14M19 5L5 19"/>', 'mapview__close-icon'));
  const panel = h(
    'aside',
    { className: 'mapview__panel' },
    h('header', { className: 'mapview__head' }, h('p', { className: 'eyebrow' }, `${cfg.site.name} · Location`), h('h2', { className: 'mapview__title', id: 'mapview-title', tabindex: -1 }, 'Directions'), close),
    h(
      'div',
      { className: 'mapview__ends' },
      h('div', { className: 'mapview__end' }, h('span', { className: 'mapview__end-dot', 'aria-hidden': 'true' }), h('label', {}, h('span', { className: 'sr-only' }, 'From'), fromSel)),
      h('div', { className: 'mapview__end' }, h('span', { className: 'mapview__end-dot mapview__end-dot--to', 'aria-hidden': 'true' }), h('label', {}, h('span', { className: 'sr-only' }, 'To'), toSel)),
      swap,
    ),
    quick,
    summary,
    steps,
    h('p', { className: 'mapview__note' }, 'Driving directions estimated from OpenStreetMap road data. Map © OpenStreetMap contributors.'),
  );
  const root = h('section', { className: 'mapview', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'mapview-title' }, stage, controls, panel);
  root.inert = true;

  /* ── view transform (pan / zoom / rotate) ────────────────────────────── */
  /** The part of the screen not covered by the panel (the route is framed there). */
  function visibleRect() {
    const W = root.clientWidth, H = root.clientHeight;
    if (isMobile.matches) return { x: 0, y: 0, w: W, h: H - Math.min(panel.offsetHeight, H * 0.6) };
    const pw = panel.offsetWidth + 32;
    return { x: pw, y: 0, w: W - pw, h: H };
  }
  /** smallest zoom at which the visible area (beside / above the panel) is still all map */
  const minScale = () => {
    const { w: W, h: H } = visibleRect(), c = Math.abs(cos), s = Math.abs(sin);
    return Math.max((W * c + H * s) / MAP_W, (W * s + H * c) / MAP_H);
  };
  const maxScale = 1.6;
  /** screen point of a map point */
  function toScreen([x, y]) {
    const r = visibleRect();
    const dx = (x - view.x) * view.s, dy = (y - view.y) * view.s;
    return [r.x + r.w / 2 + dx * cos - dy * sin, r.y + r.h / 2 + dx * sin + dy * cos];
  }
  function toWorld([sx, sy]) {
    const r = visibleRect();
    const dx = sx - (r.x + r.w / 2), dy = sy - (r.y + r.h / 2);
    return [view.x + (dx * cos + dy * sin) / view.s, view.y + (-dx * sin + dy * cos) / view.s];
  }
  /** keep the visible area on the map (under the panel it doesn't matter) */
  function clamp() {
    view.s = Math.min(maxScale, Math.max(minScale(), view.s));
    const r = visibleRect();
    for (let k = 0; k < 3; k++) {
      const pts = [[r.x, r.y], [r.x + r.w, r.y], [r.x, r.y + r.h], [r.x + r.w, r.y + r.h]].map(toWorld);
      const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
      const lo = Math.min(...xs), hi = Math.max(...xs), loY = Math.min(...ys), hiY = Math.max(...ys);
      if (lo < 0) view.x -= lo;
      else if (hi > MAP_W) view.x -= hi - MAP_W;
      if (loY < 0) view.y -= loY;
      else if (hiY > MAP_H) view.y -= hiY - MAP_H;
    }
  }
  let raf = 0;
  function draw() {
    raf = 0;
    clamp();
    const [tx, ty] = toScreen([0, 0]);
    world.style.transform = `matrix(${view.s * cos},${view.s * sin},${-view.s * sin},${view.s * cos},${tx},${ty})`;
    // the route is drawn in map pixels: keep its on-screen width constant
    routeSvg.style.setProperty('--k', String(1 / view.s));
    for (const [id, el] of markerEls) {
      const p = id === 'me' ? state.me : byId.get(id);
      if (!p) continue;
      const [x, y] = toScreen(p.xy);
      el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
    }
    zoomIn.disabled = view.s >= maxScale - 1e-3;
    zoomOut.disabled = view.s <= minScale() + 1e-3;
  }
  const schedule = () => (raf ||= requestAnimationFrame(draw));

  let anim = null;
  function animateTo(target, duration = 0.7) {
    anim?.kill();
    anim = gsap.to(view, { ...target, duration, ease: 'power3.inOut', onUpdate: schedule });
  }
  /** zoom around a screen point (keeps that point still) */
  function zoomAt(f, [px, py]) {
    const before = toWorld([px, py]);
    view.s = Math.min(maxScale, Math.max(minScale(), view.s * f));
    const after = toWorld([px, py]);
    view.x += before[0] - after[0];
    view.y += before[1] - after[1];
    schedule();
  }
  function zoomBy(f) {
    const target = Math.min(maxScale, Math.max(minScale(), view.s * f));
    animateTo({ s: target }, 0.45);
  }
  /** frame the route (or all places) in the visible area */
  function fit(animate) {
    const pts = state.result ? state.result.points : [site.xy, ...places.map((p) => p.xy)];
    const extra = [state.me?.xy, byId.get(state.from)?.xy, byId.get(state.to)?.xy].filter(Boolean);
    const all = [...pts, ...extra];
    // extent in the rotated (screen) frame
    const us = all.map(([x, y]) => x * cos - y * sin), vs = all.map(([x, y]) => x * sin + y * cos);
    const r = visibleRect();
    const spanU = Math.max(...us) - Math.min(...us) || 1, spanV = Math.max(...vs) - Math.min(...vs) || 1;
    // room for the pins' name tags around the route
    const [padX, padY] = isMobile.matches ? [150, 130] : [220, 150];
    const s = Math.min(maxScale, Math.max(minScale(), Math.min((r.w - padX) / spanU, (r.h - padY) / spanV)));
    const cu = (Math.max(...us) + Math.min(...us)) / 2, cv = (Math.max(...vs) + Math.min(...vs)) / 2;
    const target = { x: cu * cos + cv * sin, y: -cu * sin + cv * cos, s };
    if (animate) animateTo(target);
    else Object.assign(view, target), schedule();
  }

  /* pointer: drag to pan, pinch / wheel to zoom */
  const pointers = new Map();
  let last = null;
  stage.addEventListener('pointerdown', (e) => {
    if (e.target.closest('.mapview__marker')) return;
    anim?.kill();
    stage.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, [e.clientX, e.clientY]);
    last = null;
    flag(stage, 'dragging', true);
  });
  stage.addEventListener('pointermove', (e) => {
    if (!pointers.has(e.pointerId)) return;
    pointers.set(e.pointerId, [e.clientX, e.clientY]);
    const pts = [...pointers.values()];
    const c = pts.reduce((a, p) => [a[0] + p[0] / pts.length, a[1] + p[1] / pts.length], [0, 0]);
    const spread = pts.length > 1 ? Math.hypot(pts[0][0] - pts[1][0], pts[0][1] - pts[1][1]) : 0;
    if (last && last.n === pts.length) {
      const a = toWorld(last.c), b = toWorld(c);
      view.x += a[0] - b[0];
      view.y += a[1] - b[1];
      if (spread && last.spread) zoomAt(spread / last.spread, c);
      schedule();
    }
    last = { c, spread, n: pts.length };
  });
  const up = (e) => {
    pointers.delete(e.pointerId);
    last = null;
    if (!pointers.size) flag(stage, 'dragging', false);
  };
  stage.addEventListener('pointerup', up);
  stage.addEventListener('pointercancel', up);
  stage.addEventListener(
    'wheel',
    (e) => {
      e.preventDefault();
      anim?.kill();
      zoomAt(Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0018)), [e.clientX, e.clientY]);
    },
    { passive: false },
  );
  window.addEventListener('resize', () => state.open && schedule());

  /* ── directions ──────────────────────────────────────────────────────── */
  const endPoint = (id) => (id === 'me' ? state.me : byId.get(id));

  async function update() {
    fromSel.value = state.from;
    toSel.value = state.to;
    quick.querySelectorAll('.mapview__chip').forEach((c) => c.setAttribute('aria-pressed', String(c.dataset.id === state.to)));
    markerEls.forEach((el, id) => flag(el, 'active', id === state.to || id === state.from));
    const a = endPoint(state.from), b = endPoint(state.to);
    if (!a || !b) {
      state.result = null;
      drawRoute();
      return;
    }
    if (a === b) {
      state.result = null;
      drawRoute();
      render(summary, h('p', { className: 'mapview__msg' }, 'Pick two different places.'));
      render(steps);
      return;
    }
    render(summary, h('p', { className: 'mapview__msg' }, 'Finding the best route…'));
    await loadRoads();
    const res = route(a.xy, b.xy, { toName: b.name });
    state.result = res ? { ...res, from: a, to: b } : null;
    drawRoute();
    if (!res) {
      render(summary, h('p', { className: 'mapview__msg' }, "Couldn't find a driving route between these places."));
      render(steps);
      return;
    }
    render(
      summary,
      h('p', { className: 'mapview__time' }, formatDuration(res.timeS)),
      h('p', { className: 'mapview__dist' }, `${formatDistance(res.distM)} · by car`),
      h('p', { className: 'mapview__via' }, `${a.name} → ${b.name}`),
    );
    render(
      steps,
      ...res.steps.map((s) => h('li', { className: 'mapview__step', 'data-turn': s.turn }, svg(turnIcon(s.turn), 'mapview__step-icon'), h('span', { className: 'mapview__step-text' }, s.text), s.detail && h('span', { className: 'mapview__step-dist' }, s.detail))),
    );
    fit(true);
  }

  function drawRoute() {
    const r = state.result;
    const pts = r ? r.points.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ') : '';
    routeLine.setAttribute('points', pts);
    routeCasing.setAttribute('points', pts);
    // dashed links: place → nearest road at both ends
    const d = r ? `M${r.from.xy.join(',')}L${r.points[0].join(',')}M${r.points[r.points.length - 1].join(',')}L${r.to.xy.join(',')}` : '';
    routeLinks.setAttribute('d', d);
  }

  function setEnd(which, id) {
    if (which === 'from' && id === 'me') return locate();
    state[which] = id;
    if (state.from === state.to) state[which === 'to' ? 'from' : 'to'] = id === 'site' ? (places[0]?.id ?? 'site') : 'site';
    update();
  }
  function swapEnds() {
    if (state.from === 'me') return; // "my location" can only be the start
    [state.from, state.to] = [state.to, state.from];
    update();
  }

  /* visitor's own position (browser asks for permission; nothing leaves the device) */
  function locate() {
    if (!navigator.geolocation) {
      render(summary, h('p', { className: 'mapview__msg' }, "This browser can't share its location."));
      fromSel.value = state.from;
      return;
    }
    render(summary, h('p', { className: 'mapview__msg' }, 'Getting your location…'));
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const xy = toMap({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        const inside = xy[0] >= 0 && xy[1] >= 0 && xy[0] <= MAP_W && xy[1] <= MAP_H;
        if (!inside) {
          render(summary, h('p', { className: 'mapview__msg' }, `You're outside the area this map covers (about 7 km around ${cfg.site.name}). Head for the International Coastal Road towards New Alamein, then pick a starting place here.`));
          fromSel.value = state.from;
          return;
        }
        state.me = { id: 'me', name: 'Your location', kind: 'me', xy };
        if (!markerEls.has('me')) marker(state.me);
        state.from = 'me';
        if (state.to === 'me') state.to = 'site';
        update();
      },
      () => {
        render(summary, h('p', { className: 'mapview__msg' }, 'Location permission was not given. Pick a starting place instead.'));
        fromSel.value = state.from;
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  /* ── open / close ────────────────────────────────────────────────────── */
  let returnFocus = null;
  function setOpen(v, to) {
    if (to) state.to = to;
    if (v === state.open) {
      if (v && to) update();
      return;
    }
    state.open = v;
    root.inert = !v;
    if (v) {
      returnFocus = document.activeElement;
      tiles.forEach((t) => !t.src && (t.src = t.dataset.src));
      fillSelects();
      gsap.fromTo(root, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.45, ease: 'power2.out' });
      fit(false);
      update();
      root.querySelector('#mapview-title').focus({ preventScroll: true });
    } else {
      gsap.to(root, { autoAlpha: 0, duration: 0.3, ease: 'power2.in' });
      returnFocus?.focus?.({ preventScroll: true });
    }
  }
  // Esc closes the map before anything else on the page reacts to it
  window.addEventListener(
    'keydown',
    (e) => {
      if (state.open && e.key === 'Escape') {
        e.stopImmediatePropagation();
        setOpen(false);
      }
    },
    true,
  );
  gsap.set(root, { autoAlpha: 0 });

  return {
    element: root,
    /** open the map, optionally with directions to a place (by name) */
    open(placeName) {
      const p = places.find((x) => x.name === placeName);
      setOpen(true, p?.id);
    },
    close: () => setOpen(false),
  };
}
