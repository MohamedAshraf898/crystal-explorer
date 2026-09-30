import gsap from 'gsap';
import { apartmentsById, pricing } from '../data/apartments.js';
import { detailImage, floors, project } from '../data/project.js';
import { h, isMobile, render } from '../lib/dom.js';
import { COMPARE_MAX } from '../state.js';
import { createPaymentPlan } from './paymentPlan.js';
import { unitFigure } from './unitFigure.js';
import { formatArea, formatPrice, pad2 } from '../lib/format.js';
import { createInquiryForm } from './inquiry.js';
import { statusBadge } from './status.js';

/**
 * Apartment details — side panel on desktop, draggable bottom sheet on phones.
 * Shows the apartment's own crop of the architect's plan (sharp), outlined.
 */
export function createDetails(store) {
  const { actions } = store;
  const root = h('aside', { className: 'details', role: 'dialog', 'aria-modal': 'false', 'aria-labelledby': 'details-title' });
  root.inert = true;
  let apt = null;
  let tab = 'summary';
  let visible = false;
  let variant = 'side';

  function build(replay) {
    if (!apt) return;
    const a = apt;
    const floor = floors.find((f) => f.level === a.floor);
    const sold = a.status === 'sold';
    const row = (k, v) => h('div', { className: 'spec-list__row' }, h('dt', {}, k), h('dd', {}, v));
    const L = a.layout;
    const fact = (value, label) => h('div', { className: 'facts__item' }, h('span', { className: 'facts__value' }, String(value)), h('span', { className: 'facts__label' }, label));
    const plural = (n, one, many) => (n === 1 ? one : many);

    const body =
      tab === 'inquiry'
        ? h('div', { className: 'details__body' }, createInquiryForm(a, () => setTab('summary')))
        : h(
            'div',
            { className: 'details__body' },
            h('div', { 'data-reveal': true }, unitFigure(a)),
            h('div', { className: 'details__area', 'data-reveal': true }, h('span', { className: 'details__area-value' }, String(a.area)), h('span', { className: 'details__area-unit' }, 'm²')),
            h(
              'div',
              { className: 'facts', 'data-reveal': true },
              fact(L.bedrooms, plural(L.bedrooms, 'Bedroom', 'Bedrooms')),
              fact(L.bathrooms, plural(L.bathrooms, 'Bathroom', 'Bathrooms')),
              L.toilets > 0 && fact(L.toilets, 'Guest toilet'),
              L.garden > 0 ? fact(`${L.garden} m²`, 'Garden') : L.roofTerrace > 0 ? fact(`${L.roofTerrace} m²`, 'Terrace') : L.terraces > 0 && fact(L.terraces, plural(L.terraces, 'Terrace', 'Terraces')),
            ),
            h(
              'dl',
              { className: 'spec-list', 'data-reveal': true },
              row('Apartment', pad2(a.number)),
              row('Floor', floor.name),
              row('Built-up area', formatArea(a.area)),
              row('Bedrooms', [L.bedrooms, L.masterSuite && '(incl. master)'].filter(Boolean).join(' ')),
              row('Bathrooms', [L.bathrooms, L.toilets && `+ ${L.toilets} guest toilet`].filter(Boolean).join(' ')),
              row('Living', [L.reception, L.living && 'living room'].filter(Boolean).join(' + ')),
              L.dressing && row('Dressing room', 'Yes'),
              L.terraces > 0 && row(plural(L.terraces, 'Terrace', 'Terraces'), String(L.terraces)),
              L.roofTerrace > 0 && row('Private terrace', formatArea(L.roofTerrace)),
              L.garden > 0 && row('Private garden', formatArea(L.garden)),
              L.pool && row('Private pool', 'Yes'),
              row('Project', `${project.name} ${project.location}`),
              row('Delivery', project.delivery),
            ),
            h(
              'div',
              { className: 'details__meta', 'data-reveal': true },
              h('div', {}, h('p', { className: 'eyebrow' }, 'Status'), statusBadge(a.status, 'lg')),
              h('div', {}, h('p', { className: 'eyebrow' }, a.estimated ? 'Estimated price' : 'Price'), h('p', { className: 'details__price', 'data-sold': sold || null }, formatPrice(a.price))),
            ),
            a.estimated && a.price != null && h('p', { className: 'details__disclaimer', 'data-reveal': true }, `Estimate based on about ${project.currency} ${new Intl.NumberFormat('en-US').format(pricing.perM2)}/m², adjusted for floor, garden and terrace. Contact sales for the official price.`),
            h('div', { 'data-reveal': true }, createPaymentPlan(a)),
            h(
              'section',
              { className: 'rooms', 'data-reveal': true },
              h('p', { className: 'eyebrow' }, 'Room schedule'),
              h('ul', { className: 'rooms__list' }, ...L.rooms.map(([name, size]) => h('li', {}, h('span', {}, name), h('span', {}, size)))),
              L.garden > 0 && h('p', { className: 'rooms__note' }, `Private garden ${formatArea(L.garden)}${L.pool ? ' with plunge pool' : ''}`),
              L.roofTerrace > 0 && h('p', { className: 'rooms__note' }, `Private terrace ${formatArea(L.roofTerrace)}`),
            ),
            tab === 'details' &&
              h(
                'div',
                { className: 'details__more', 'data-reveal': true },
                h('img', { className: 'details__photo', src: isMobile.matches ? detailImage.imageSmall : detailImage.image, alt: `${project.name} ${project.location} facade`, loading: 'lazy' }),
                h('p', { className: 'details__note' }, `Developed by ${project.developer} with ${project.partners.filter((p) => p !== project.developer).join(' & ')}. For availability and payment plans call ${project.hotline}.`),
              ),
            h(
              'div',
              { className: 'details__actions', 'data-reveal': true },
              h('button', { type: 'button', className: 'btn btn--ghost', 'aria-expanded': String(tab === 'details'), onClick: () => setTab(tab === 'details' ? 'summary' : 'details') }, tab === 'details' ? 'Hide details' : 'View details'),
              h('button', { type: 'button', className: 'btn btn--solid', disabled: sold, onClick: () => setTab('inquiry') }, a.status === 'reserved' ? 'Join waitlist' : 'Request information', h('span', { className: 'btn__arrow', 'aria-hidden': 'true' }, '→')),
            ),
            compareRow(a),
            h('a', { className: 'details__call', href: `tel:${project.hotline}`, 'data-reveal': true }, `Call ${project.hotline}`),
          );

    render(
      root,
      variant === 'sheet' && handle,
      h(
        'header',
        { className: 'details__head' },
        h('p', { className: 'eyebrow', 'data-reveal': true }, `${floor.name} · ${project.name} ${project.location}`),
        h('h2', { id: 'details-title', className: 'details__title', tabindex: -1, 'data-reveal': true }, `Apartment ${a.number}`),
        h('button', { type: 'button', className: 'icon-btn details__close', 'aria-label': `Close apartment ${a.number} details`, onClick: () => actions.backToFloor() }, closeIcon()),
      ),
      body,
    );
    root.dataset.variant = variant;
    if (replay) {
      const items = body.querySelectorAll('[data-reveal]');
      if (items.length) gsap.fromTo(items, { y: 10, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.5, stagger: 0.04, ease: 'power3.out' });
    }
  }

  /** "Add to compare" + a shortcut to the comparison once two are picked. */
  function compareRow(a) {
    const { compare } = store.get();
    const inList = compare.includes(a.id);
    const full = !inList && compare.length >= COMPARE_MAX;
    return h(
      'div',
      { className: 'details__compare', 'data-reveal': true },
      h(
        'button',
        { type: 'button', className: 'compare-toggle', 'aria-pressed': String(inList), disabled: full, onClick: () => actions.toggleCompare(a.id) },
        h('span', { className: 'compare-toggle__box', 'aria-hidden': 'true' }),
        inList ? 'Added to compare' : full ? `Compare is full (${COMPARE_MAX})` : 'Add to compare',
      ),
      compare.length >= 2 && h('button', { type: 'button', className: 'details__compare-open', onClick: () => actions.openCompare() }, `Compare ${compare.length} →`),
    );
  }

  const closeIcon = () => {
    const t = document.createElement('template');
    t.innerHTML = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 3l10 10M13 3L3 13"/></svg>';
    return t.content.firstElementChild;
  };

  function setTab(next) {
    tab = next;
    build(true);
    root.querySelector('.details__body')?.scrollTo({ top: 0 });
  }

  /* bottom-sheet drag to dismiss */
  let drag = null;
  const endDrag = () => {
    if (!drag) return;
    const dy = drag.dy;
    drag = null;
    if (dy > 90) actions.backToFloor();
    else gsap.to(root, { y: 0, duration: 0.35, ease: 'power3.out' });
  };
  const handle = h(
    'div',
    {
      className: 'details__handle',
      'aria-hidden': 'true',
      onPointerDown: (e) => {
        drag = { y: e.clientY, dy: 0 };
        e.currentTarget.setPointerCapture(e.pointerId);
      },
      onPointerMove: (e) => {
        if (!drag) return;
        drag.dy = Math.max(0, e.clientY - drag.y);
        gsap.set(root, { y: drag.dy });
      },
      onPointerUp: endDrag,
      onPointerCancel: endDrag,
    },
    h('span'),
  );

  function open() {
    visible = true;
    root.inert = false;
    const from = variant === 'side' ? { xPercent: 104, yPercent: 0, y: 0, autoAlpha: 0 } : { yPercent: 104, xPercent: 0, y: 0, autoAlpha: 1 };
    gsap.fromTo(root, from, { xPercent: 0, yPercent: 0, autoAlpha: 1, duration: 0.85, ease: 'expo.out', delay: 0.25 });
    gsap.fromTo(root.querySelectorAll('[data-reveal]'), { y: 14, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.6, stagger: 0.045, ease: 'power3.out', delay: 0.45 });
    root.querySelector('#details-title')?.focus({ preventScroll: true });
  }

  function close() {
    visible = false;
    root.inert = true;
    gsap.to(root, { ...(variant === 'side' ? { xPercent: 104, autoAlpha: 0 } : { yPercent: 104 }), duration: 0.5, ease: 'power3.in' });
  }

  store.subscribe((st, p) => {
    if (st.compare !== p.compare && apt && visible && st.selectedApartment === p.selectedApartment) {
      // refresh only the compare row, keep scroll position and tab
      const old = root.querySelector('.details__compare');
      if (old) old.replaceWith(compareRow(apt));
    }
    if (st.selectedApartment === p.selectedApartment) return;
    const next = apartmentsById.get(st.selectedApartment) ?? null;
    if (next) {
      const opening = !visible;
      if (opening) variant = isMobile.matches ? 'sheet' : 'side';
      apt = next;
      tab = 'summary';
      build(!opening);
      if (opening) open();
    } else if (visible) close();
  });

  return root;
}
