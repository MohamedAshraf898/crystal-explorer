import { apartmentsById } from '../data/apartments.js';
import { floors, project } from '../data/project.js';
import { h, render } from '../lib/dom.js';

export function createTopBar(store) {
  const { actions } = store;
  const crumbs = h('ol');
  const update = () => {
    const st = store.get();
    const floor = floors.find((f) => f.level === st.selectedFloor);
    const apt = apartmentsById.get(st.selectedApartment);
    render(
      crumbs,
      h('li', {}, h('button', { type: 'button', 'aria-current': st.viewMode === 'building' ? 'page' : null, onClick: actions.backToBuilding }, 'Building')),
      floor && h('li', {}, h('button', { type: 'button', 'aria-current': st.viewMode === 'floor' ? 'page' : null, onClick: actions.backToFloor }, floor.name)),
      apt && h('li', {}, h('span', { 'aria-current': 'page' }, `Apartment ${apt.number}`)),
    );
  };
  update();
  store.subscribe((st, p) => {
    if (st.viewMode !== p.viewMode || st.selectedFloor !== p.selectedFloor || st.selectedApartment !== p.selectedApartment) update();
  });

  return h(
    'header',
    { className: 'topbar' },
    h(
      'a',
      { className: 'brand', href: './', 'aria-label': `${project.name} ${project.location} — home` },
      h('img', { className: 'brand__logo brand__logo--light', src: 'assets/brand/crystal-white.png', alt: '', width: 792, height: 1046 }),
      h('img', { className: 'brand__logo brand__logo--dark', src: 'assets/brand/crystal-dark.png', alt: '', width: 792, height: 1046 }),
    ),
    h('nav', { className: 'crumbs', 'aria-label': 'Breadcrumb' }, crumbs),
    h(
      'div',
      { className: 'topbar__end' },
      h('img', { className: 'dev-logo dev-logo--light', src: 'assets/brand/darak-white.png', alt: project.developer, width: 432, height: 131 }),
      h('img', { className: 'dev-logo dev-logo--dark', src: 'assets/brand/darak-dark.png', alt: project.developer, width: 432, height: 131 }),
      h('a', { className: 'hotline', href: `tel:${project.hotline}`, 'aria-label': `Call hotline ${project.hotline}` }, h('span', { className: 'hotline__label' }, 'Hotline'), project.hotline),
    ),
  );
}
