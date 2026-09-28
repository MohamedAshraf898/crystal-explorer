import gsap from 'gsap';
import { floors, project } from '../data/project.js';
import { h } from '../lib/dom.js';
import { pad2 } from '../lib/format.js';

/** Large editorial floor number shown over the plan ("04 — Fourth Floor"). */
export function createFloorTitle() {
  const num = h('span', { className: 'floor-title__num' });
  const name = h('span', { className: 'floor-title__name' });
  const root = h('div', { className: 'floor-title', 'aria-hidden': 'true' }, h('span', { className: 'floor-title__eyebrow' }, `${project.name} · ${project.location}`), num, name);
  return {
    element: root,
    set(level) {
      const f = floors.find((x) => x.level === level);
      num.textContent = pad2(level);
      name.textContent = f?.name ?? '';
    },
    hide() {
      return gsap.to(root, { autoAlpha: 0, duration: 0.4, ease: 'power2.in' });
    },
    animateIn() {
      gsap.set(root, { autoAlpha: 1 });
      return gsap.fromTo(root.children, { autoAlpha: 0, y: 18 }, { autoAlpha: 1, y: 0, duration: 0.9, ease: 'power3.out', stagger: 0.08 });
    },
  };
}
