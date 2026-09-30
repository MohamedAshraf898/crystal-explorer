import { paymentPlans, paymentSchedule } from '../data/paymentPlans.js';
import { h, render } from '../lib/dom.js';
import { formatPrice } from '../lib/format.js';

/**
 * Payment plan for one apartment: pick 10 / 8 / 6 years, see the down payment,
 * monthly and yearly installments, a per-year breakdown and (on demand) every
 * installment with its date. Keeps its own state, re-renders only itself.
 */
const monthFmt = new Intl.DateTimeFormat('en-GB', { month: 'short', year: 'numeric' });
const pct = (p) => `${(p * 100).toFixed(p * 100 < 1 ? 2 : 1).replace(/\.?0+$/, '')}%`;
const KIND = { down: 'Down payment', monthly: 'Monthly', yearly: 'Yearly' };

let lastPlan = paymentPlans[0].id; // remembered while browsing apartments

export function createPaymentPlan(apt) {
  const root = h('section', { className: 'pay', 'aria-labelledby': `pay-title-${apt.id}` });
  let planId = lastPlan;
  let expanded = false;

  function draw() {
    const s = paymentSchedule(apt.price, planId);
    if (!s) {
      render(root, h('p', { className: 'eyebrow' }, 'Payment plan'), h('p', { className: 'pay__note' }, 'Contact sales for payment plans.'));
      return;
    }
    const range = ([a, b]) => (a === b ? formatPrice(a) : `${formatPrice(a)} – ${new Intl.NumberFormat('en-US').format(b)}`);
    const stat = (label, value, sub) => h('div', { className: 'pay__stat' }, h('dt', {}, label), h('dd', {}, value, sub && h('small', {}, sub)));
    render(
      root,
      h('p', { className: 'eyebrow', id: `pay-title-${apt.id}` }, apt.estimated ? 'Payment plan · estimated' : 'Payment plan'),
      h(
        'div',
        { className: 'pay__tabs', role: 'radiogroup', 'aria-label': 'Plan length' },
        ...paymentPlans.map((p) =>
          h(
            'button',
            {
              type: 'button',
              role: 'radio',
              className: 'pay__tab',
              'aria-checked': String(p.id === planId),
              tabindex: p.id === planId ? 0 : -1,
              onClick: () => select(p.id),
              onKeydown: (e) => {
                const i = paymentPlans.findIndex((x) => x.id === planId);
                const d = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
                if (!d) return;
                e.preventDefault();
                select(paymentPlans[(i + d + paymentPlans.length) % paymentPlans.length].id, true);
              },
            },
            p.label,
          ),
        ),
      ),
      h(
        'dl',
        { className: 'pay__stats' },
        stat('Down payment', formatPrice(s.down), `${pct(s.plan.downPct)} · 4 × ${pct(s.plan.downPct / 4)} over the first 4 months`),
        stat('Monthly installment', range(s.monthlyRange), 'rises each year'),
        stat('Yearly installment', range(s.yearlyRange), 'every 12th month, instead of the monthly one'),
        stat('Duration', `${s.items.length} installments`, `${monthFmt.format(s.items[0].date)} – ${monthFmt.format(s.end)}`),
      ),
      h(
        'table',
        { className: 'pay__years' },
        h('caption', { className: 'sr-only' }, `Total paid per year, ${s.plan.label} plan`),
        h('thead', {}, h('tr', {}, h('th', { scope: 'col' }, 'Year'), h('th', { scope: 'col' }, 'Paid that year'), h('th', { scope: 'col' }, 'Share'))),
        h(
          'tbody',
          {},
          ...s.years.map((y) =>
            h(
              'tr',
              {},
              h('th', { scope: 'row' }, `Year ${y.year}`),
              h('td', {}, formatPrice(y.total)),
              h('td', {}, h('span', { className: 'pay__bar', style: `--w:${Math.max(4, (y.total / Math.max(...s.years.map((z) => z.total))) * 100)}%`, 'aria-hidden': 'true' }), pct(y.total / s.total)),
            ),
          ),
        ),
        h('tfoot', {}, h('tr', {}, h('th', { scope: 'row' }, 'Total'), h('td', {}, formatPrice(s.total)), h('td', {}, '100%'))),
      ),
      h(
        'button',
        { type: 'button', className: 'pay__toggle', 'aria-expanded': String(expanded), onClick: () => ((expanded = !expanded), draw()) },
        expanded ? 'Hide installments' : `Show all ${s.items.length} installments`,
      ),
      expanded &&
        h(
          'ol',
          { className: 'pay__list' },
          ...s.items.map((x) =>
            h(
              'li',
              { 'data-kind': x.kind },
              h('span', { className: 'pay__n' }, String(x.n)),
              h('span', { className: 'pay__date' }, monthFmt.format(x.date)),
              h('span', { className: 'pay__kind' }, KIND[x.kind]),
              h('span', { className: 'pay__amount' }, formatPrice(x.amount)),
            ),
          ),
        ),
      h('p', { className: 'pay__note' }, 'Indicative plan following the developer’s sample pattern; dates start next month. Final plans are confirmed by sales.'),
    );
  }

  function select(id, focus) {
    planId = lastPlan = id;
    draw();
    if (focus) root.querySelector('.pay__tab[aria-checked="true"]')?.focus();
  }

  draw();
  return root;
}
