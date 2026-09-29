import gsap from 'gsap';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  DIRECTOR — every animation in one place.
 * ─────────────────────────────────────────────────────────────────────────────
 *  It listens to the store and decides the choreography, so a click on the
 *  photo, the floor list, the unit list, the breadcrumb or Esc always
 *  produces exactly the same motion.
 */

const EASE = 'power3.inOut';

export function createDirector({ store, building, plan, floorTitle }) {
  let busy = null; // current big transition timeline

  /* ── building: floor hover ───────────────────────────────────────────── */
  function animateFloorHover(level) {
    building.highlight(level);
    const layer = building.layer;
    if (!layer) return;
    gsap.to(layer.dim, { opacity: level != null ? 0.55 : 0, duration: 0.5, ease: 'power2.out', overwrite: 'auto' });
  }

  /* ── building → floor ────────────────────────────────────────────────── */
  function animateFloorSelect(level) {
    busy?.kill();
    const layer = building.layer;
    const origin = building.bandOrigin(level);
    plan.setFloor(level);
    floorTitle.set(level);
    building.highlight(level);

    const tl = gsap.timeline();
    tl.to(layer.dim, { opacity: 0.8, duration: 0.6, ease: 'power2.out' }, 0)
      .to(layer.zoom, { scale: 1.32, transformOrigin: origin, duration: 1.5, ease: EASE }, 0)
      .to(building.element, { autoAlpha: 0, duration: 0.7, ease: 'power2.in' }, 0.75)
      .fromTo(plan.element, { autoAlpha: 0, scale: 0.94 }, { autoAlpha: 1, scale: 1, duration: 1.1, ease: 'expo.out' }, 1.05)
      .add(floorTitle.animateIn(), 1.15);
    busy = tl;
  }

  /* ── floor → another floor (floor list while a floor is open) ────────── */
  function animateFloorSwitch(level) {
    busy?.kill();
    const tl = gsap.timeline();
    tl.to(plan.element, { autoAlpha: 0, scale: 0.985, duration: 0.35, ease: 'power2.in' })
      .add(() => {
        plan.setFloor(level);
        floorTitle.set(level);
      })
      .to(plan.element, { autoAlpha: 1, scale: 1, duration: 0.7, ease: 'expo.out' })
      .add(floorTitle.animateIn(), '<');
    busy = tl;
  }

  /* ── floor → building ────────────────────────────────────────────────── */
  function animateFloorReset() {
    busy?.kill();
    const layer = building.layer;
    building.highlight(null);
    floorTitle.hide();
    const tl = gsap.timeline();
    tl.to(plan.element, { autoAlpha: 0, scale: 0.96, duration: 0.5, ease: 'power2.in' }, 0)
      .to(building.element, { autoAlpha: 1, duration: 0.8, ease: 'power2.out' }, 0.3)
      .to(layer.zoom, { scale: 1, duration: 1.4, ease: EASE }, 0.25)
      .to(layer.dim, { opacity: 0, duration: 0.9, ease: 'power2.out' }, 0.6);
    busy = tl;
  }

  /* ── plan: unit hover / select / reset ───────────────────────────────── */
  function animateApartmentHover(id, selected) {
    const focus = id ?? selected;
    plan.highlight(focus);
    gsap.to(plan.dim, { opacity: focus ? (selected ? 0.62 : 0.42) : 0, duration: 0.45, ease: 'power2.out', overwrite: 'auto' });
  }

  function tweenViewBox(target, duration = 1.25) {
    return gsap.to(plan.viewBox, { ...target, duration, ease: EASE, onUpdate: plan.applyViewBox, overwrite: 'auto' });
  }

  function animateApartmentSelect(id) {
    plan.highlight(id);
    gsap.to(plan.dim, { opacity: 0.62, duration: 0.6, ease: 'power2.out', overwrite: 'auto' });
    // Wait one frame so the stage has its apartment-mode size before framing.
    requestAnimationFrame(() => tweenViewBox(plan.unitBox(id)));
  }

  function animateApartmentReset() {
    plan.highlight(null);
    gsap.to(plan.dim, { opacity: 0, duration: 0.6, ease: 'power2.out', overwrite: 'auto' });
    requestAnimationFrame(() => {
      tweenViewBox(plan.contentBox(), 1.1);
      plan.centerScroll();
    });
  }

  /* ── intro ───────────────────────────────────────────────────────────── */
  function animateIntro() {
    const layer = building.layer;
    gsap.fromTo(layer.zoom, { scale: 1.08, transformOrigin: '50% 50%' }, { scale: 1, duration: 3.2, ease: 'power2.out' });
    gsap.fromTo('.topbar, .floor-nav, .view-switch', { autoAlpha: 0, y: 12 }, { autoAlpha: 1, y: 0, duration: 1, ease: 'power3.out', stagger: 0.1, delay: 0.5, clearProps: 'transform' });
  }

  /* ── state → choreography ───────────────────────────────────────────── */
  store.subscribe((st, prev) => {
    if (st.ready && !prev.ready) animateIntro();

    if (st.view !== prev.view) building.show(st.view, true);

    const modeChanged = st.viewMode !== prev.viewMode;
    if (modeChanged || st.selectedFloor !== prev.selectedFloor || st.selectedApartment !== prev.selectedApartment) {
      if (st.viewMode === 'building' && prev.viewMode !== 'building') animateFloorReset();
      else if (st.viewMode !== 'building' && prev.viewMode === 'building') animateFloorSelect(st.selectedFloor);
      else if (st.selectedFloor !== prev.selectedFloor && st.viewMode !== 'building') animateFloorSwitch(st.selectedFloor);

      if (st.viewMode === 'apartment' && st.selectedApartment !== prev.selectedApartment) {
        if (prev.viewMode === 'building') gsap.delayedCall(1.6, () => animateApartmentSelect(st.selectedApartment));
        else animateApartmentSelect(st.selectedApartment);
      } else if (st.viewMode === 'floor' && prev.viewMode === 'apartment' && st.selectedFloor === prev.selectedFloor) {
        animateApartmentReset();
      }
      return;
    }

    if (st.viewMode === 'building' && st.hoveredFloor !== prev.hoveredFloor) animateFloorHover(st.hoveredFloor);
    if (st.viewMode !== 'building' && st.hoveredApartment !== prev.hoveredApartment) animateApartmentHover(st.hoveredApartment, st.selectedApartment);
  });

  // Re-frame the selected apartment when the window changes size.
  let t = 0;
  window.addEventListener('resize', () => {
    clearTimeout(t);
    t = setTimeout(() => {
      const st = store.get();
      if (st.viewMode === 'apartment') tweenViewBox(plan.unitBox(st.selectedApartment), 0.5);
    }, 200);
  });
}
