/** Tiny DOM helpers — the UI is plain DOM, no framework. */

const SVG_NS = 'http://www.w3.org/2000/svg';

/** Create an HTML element. `on*` props become listeners; true → boolean attribute; false/null → skipped. */
export function h(tag, props = {}, ...children) {
  const el = document.createElement(tag);
  applyProps(el, props);
  append(el, children);
  return el;
}

/** Create an SVG element. */
export function s(tag, props = {}, ...children) {
  const el = document.createElementNS(SVG_NS, tag);
  applyProps(el, props);
  append(el, children);
  return el;
}

function applyProps(el, props) {
  for (const [key, value] of Object.entries(props)) {
    if (value === undefined || value === null || value === false) continue;
    if (key.startsWith('on') && typeof value === 'function') el.addEventListener(key.slice(2).toLowerCase(), value);
    else if (key === 'className') el.setAttribute('class', value);
    else el.setAttribute(key, value === true ? '' : String(value));
  }
}

export function append(parent, children) {
  for (const child of children.flat()) {
    if (child === null || child === undefined || child === false) continue;
    parent.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
}

export function render(parent, ...children) {
  parent.replaceChildren();
  append(parent, children);
}

export function flag(el, name, on) {
  if (on) el.setAttribute(`data-${name}`, '');
  else el.removeAttribute(`data-${name}`);
}

export const media = (query) => window.matchMedia(query);
export const isMobile = media('(max-width: 767px)');
export const isTouch = media('(hover: none), (pointer: coarse)');

export const pointsAttr = (poly) => poly.map(([x, y]) => `${x},${y}`).join(' ');

/** Keep decoded images referenced so the browser keeps them warm in its cache. */
const warm = [];

/** Fetch + decode an image off the main thread; resolves when ready (never rejects). */
export function decodeImage(src) {
  const img = new Image();
  img.decoding = 'async';
  img.src = src;
  warm.push(img);
  return img.decode().catch(() => {});
}

/** Load an image; resolves when decoded (used by the loader and view switching). */
export function preload(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = img.onerror = () => resolve(img);
    img.src = src;
  });
}
