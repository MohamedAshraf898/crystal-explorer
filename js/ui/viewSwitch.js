import { views } from '../data/project.js';
import gsap from 'gsap';
import { h } from '../lib/dom.js';

/** Night / Day switcher for the building photo. */
export function createViewSwitch(store) {
  const buttons = views.map((v) =>
    h('button', { type: 'button', className: 'view-switch__btn', 'aria-pressed': String(v.id === store.get().view), onClick: () => store.actions.setView(v.id) }, v.label),
  );
  const root = h('div', { className: 'view-switch', role: 'group', 'aria-label': 'Building view' }, ...buttons);
  const indicator = h('span', { className: 'view-switch__indicator', 'aria-hidden': 'true' });
  root.prepend(indicator);
  const place = () => {
    const i = views.findIndex((v) => v.id === store.get().view);
    const b = buttons[i];
    indicator.style.transform = `translateX(${b.offsetLeft}px)`;
    indicator.style.width = `${b.offsetWidth}px`;
  };
  store.subscribe((st, p) => {
    if (st.view !== p.view) {
      views.forEach((v, i) => buttons[i].setAttribute('aria-pressed', String(v.id === st.view)));
      place();
    }
    if (st.viewMode !== p.viewMode) {
      const show = st.viewMode === 'building';
      root.inert = !show;
      gsap.to(root, { autoAlpha: show ? 1 : 0, duration: show ? 0.8 : 0.3, delay: show ? 0.8 : 0, ease: 'power2.out', overwrite: 'auto' });
    }
  });
  requestAnimationFrame(place);
  window.addEventListener('resize', place);
  document.fonts?.ready.then(place);
  return root;
}
