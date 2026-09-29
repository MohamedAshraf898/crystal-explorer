import { floorSummary } from '../data/apartments.js';
import { floors } from '../data/project.js';
import { flag, h } from '../lib/dom.js';
import { pad2 } from '../lib/format.js';

/**
 * Floor index — hover/focus previews the floor on the photo, click opens it.
 * Same store actions as the photo itself. Arrow keys move between floors.
 */
export function createFloorNav(store) {
  const { actions } = store;
  const buttons = new Map();
  const clearUi = () => {
    if (store.get().hoverSource === 'ui') actions.hoverFloor(null);
  };
  const list = h('ol', { className: 'floor-nav__list' });
  for (const floor of [...floors].reverse()) {
    const sum = floorSummary(floor.level);
    const b = h(
      'button',
      {
        type: 'button',
        className: 'floor-nav__item',
        'aria-label': `${floor.name}: ${sum.available} of ${sum.total} apartments available`,
        onClick: () => actions.selectFloor(floor.level),
        onMouseEnter: () => actions.hoverFloor(floor.level, 'ui'),
        onMouseLeave: clearUi,
        onFocus: () => actions.hoverFloor(floor.level, 'ui'),
        onBlur: clearUi,
      },
      h('span', { className: 'floor-nav__num' }, pad2(floor.level)),
      h('span', { className: 'floor-nav__tick', 'aria-hidden': 'true' }),
      h('span', { className: 'floor-nav__meta', 'aria-hidden': 'true' }, `${sum.available}/${sum.total}`),
    );
    buttons.set(floor.level, b);
    list.append(h('li', {}, b));
  }
  list.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
    const all = [...buttons.values()];
    const i = all.indexOf(document.activeElement);
    if (i < 0) return;
    e.preventDefault();
    all[Math.max(0, Math.min(all.length - 1, i + (e.key === 'ArrowDown' ? 1 : -1)))].focus();
  });
  /**
   * Phones: keep the active floor chip centred in the bottom bar. Scrolls ONLY
   * the bar — scrollIntoView() would also scroll the page itself on iOS Safari
   * (the whole site shifted left for the right-hand floors 4–6).
   */
  function centerChip(button) {
    if (!button || list.scrollWidth <= list.clientWidth) return;
    const l = list.getBoundingClientRect();
    const b = button.getBoundingClientRect();
    list.scrollTo({ left: list.scrollLeft + (b.left - l.left) - (l.width - b.width) / 2, behavior: 'smooth' });
  }

  store.subscribe((st, p) => {
    if (st.hoveredFloor !== p.hoveredFloor) buttons.forEach((b, l) => flag(b, 'hovered', l === st.hoveredFloor));
    if (st.selectedFloor !== p.selectedFloor) {
      buttons.forEach((b, l) => {
        flag(b, 'active', l === st.selectedFloor);
        if (l === st.selectedFloor) b.setAttribute('aria-current', 'location');
        else b.removeAttribute('aria-current');
      });
      centerChip(buttons.get(st.selectedFloor));
    }
  });
  return h('nav', { className: 'floor-nav', 'aria-label': 'Floors' }, h('p', { className: 'eyebrow floor-nav__title' }, 'Floors'), list);
}
