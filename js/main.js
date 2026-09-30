import { plans } from './data/plans.js';
import { views } from './data/project.js';
import { createDirector } from './director.js';
import { decodeImage, h, isMobile, preload } from './lib/dom.js';
import { createStore } from './state.js';
import { createDetails } from './ui/details.js';
import { createFilters } from './ui/filters.js';
import { createFloorNav } from './ui/floorNav.js';
import { createFloorPanel } from './ui/floorPanel.js';
import { createFloorTitle } from './ui/floorTitle.js';
import { createBackButton, createHint, createLiveRegion, createLoader } from './ui/misc.js';
import { createTooltip } from './ui/tooltip.js';
import { createTopBar } from './ui/topbar.js';
import { createViewSwitch } from './ui/viewSwitch.js';
import { createBuildingView } from './views/buildingView.js';
import { createPlanView } from './views/planView.js';

/**
 * Crystal Alamein — interactive building explorer.
 * Plain JavaScript modules: data → store → views → UI. No framework, no build.
 */
async function main() {
  const store = createStore();
  const app = h('main', { className: 'app', 'data-mode': 'building' });
  document.getElementById('app').append(app);

  const loader = createLoader();
  document.body.append(loader.element);

  // Stages (photo + plan)
  const building = createBuildingView(store);
  const plan = createPlanView(store);
  const floorTitle = createFloorTitle();
  app.append(building.element, plan.element, floorTitle.element);

  // UI layer
  const ui = h('div', { className: 'ui' });
  const topBar = createTopBar(store);
  const filters = createFilters(store);
  topBar.querySelector('.topbar__end').prepend(filters.button);
  ui.append(
    topBar,
    createBackButton(store),
    createFloorNav(store),
    createViewSwitch(store),
    createTooltip(store, { building, plan }),
    createFloorPanel(store),
    createDetails(store),
    filters.panel,
    createHint(store),
    createLiveRegion(store),
  );
  app.append(ui);

  createDirector({ store, building, plan, floorTitle });

  let modeTimer = 0;
  store.subscribe((st, p) => {
    if (st.viewMode !== p.viewMode) {
      // Going into a floor, keep the light-on-photo UI until the photo has faded.
      clearTimeout(modeTimer);
      if (p.viewMode === 'building') modeTimer = setTimeout(() => (app.dataset.mode = store.get().viewMode), 950);
      else app.dataset.mode = st.viewMode;
    }
    if (st.viewMode !== 'building' && p.viewMode === 'building') document.body.style.cursor = '';
  });
  // Safety net: the page itself must never scroll (iOS can shift it sideways).
  window.addEventListener('scroll', () => {
    if (window.scrollX || window.scrollY) window.scrollTo(0, 0);
  });
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') store.actions.back();
  });

  if (new URLSearchParams(location.search).has('debug')) {
    app.classList.add('debug');
    window.__store = store;
  }

  // Preload the first photo (+ brand) with real progress, then the other views quietly.
  const small = window.innerWidth < 1100;
  const first = views.find((v) => v.id === store.get().view);
  const critical = [small ? first.imageSmall : first.image, 'assets/brand/crystal-white.png'];
  let loaded = 0;
  await Promise.all(critical.map((src) => preload(src).then(() => loader.progress((++loaded / critical.length) * 100))));
  await building.ready; // first photo decoded and laid out
  await loader.done();
  store.actions.setReady();

  // Warm the cache while the visitor looks at the building: other photos, then the
  // floor plans — decoded ahead of time so opening a floor doesn't stall on a decode.
  const idle = window.requestIdleCallback ?? ((fn) => setTimeout(fn, 800));
  idle(async () => {
    for (const v of views.filter((v) => v !== first)) await decodeImage(small ? v.imageSmall : v.image);
    for (const p of Object.values(plans)) await decodeImage(isMobile.matches ? p.imageSmall : p.image);
  });
}

main();
