import { h, pointsAttr, s } from '../lib/dom.js';

/** Sharp crop of the architect's plan around one apartment, outlined. */
export function unitFigure(a, caption = `Apartment ${a.number} · plan for illustration`) {
  const c = a.unit.crop;
  return h(
    'figure',
    { className: 'unit-figure' },
    s(
      'svg',
      { viewBox: `${c.x} ${c.y} ${c.w} ${c.h}`, role: 'img', 'aria-label': `Floor plan of apartment ${a.number}` },
      s('image', { href: c.src, x: c.x, y: c.y, width: c.w, height: c.h, preserveAspectRatio: 'none' }),
      s('polygon', { className: 'unit-figure__outline', points: pointsAttr(a.unit.poly) }),
    ),
    caption && h('figcaption', {}, caption),
  );
}
