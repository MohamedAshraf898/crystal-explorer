/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  PAYMENT PLANS — edit here
 * ─────────────────────────────────────────────────────────────────────────────
 *  Pattern taken from the sample sheet "Badya Value By Years — option 2"
 *  (10 / 8 / 6-year client payment columns): a down payment of 4 × 1.5 %,
 *  then small monthly installments plus a larger installment every 12th month,
 *  both rising each year.
 *
 *  The sample was a re-schedule of an existing contract, so its percentages
 *  add up to less than 100 %. Here the down payment is kept exactly and the
 *  monthly / yearly installments are scaled together so that every plan adds
 *  up to 100 % of the apartment price (same shape, full price).
 *
 *  Each plan is a list of runs: [percent of price, how many months].
 */
const RAW = [
  {
    id: '10y',
    label: '10 years',
    runs: [
      [0.015, 4], [0.0022, 7], [0.054, 1],
      [0.0024, 11], [0.055, 1], [0.0025, 11], [0.056, 1], [0.0026, 11], [0.057, 1], [0.0027, 11], [0.059, 1],
      [0.0028, 11], [0.06, 1], [0.0029, 11], [0.062, 1], [0.003, 11], [0.064, 1], [0.003, 11], [0.065, 1],
      [0.003, 6],
    ],
  },
  {
    id: '8y',
    label: '8 years',
    runs: [
      [0.015, 4], [0.0024, 7], [0.058, 1],
      [0.0025, 11], [0.059, 1], [0.0028, 11], [0.062, 1], [0.003, 11], [0.065, 1], [0.0032, 11], [0.068, 1],
      [0.0034, 11], [0.072, 1], [0.0035, 11], [0.074, 1],
      [0.0035, 6],
    ],
  },
  {
    id: '6y',
    label: '6 years',
    runs: [
      [0.015, 4], [0.00245, 7], [0.06, 1],
      [0.0026, 11], [0.065, 1], [0.0029, 11], [0.07, 1], [0.0031, 11], [0.074, 1], [0.0033, 11], [0.075, 1],
      [0.00345, 6],
    ],
  },
];

const DOWN_MONTHS = 4; // the first 4 installments (4 × 1.5 %) form the down payment

/** Plans with every monthly percentage, normalised to 100 %. */
export const paymentPlans = RAW.map(({ id, label, runs }) => {
  const pcts = runs.flatMap(([p, n]) => Array(n).fill(p));
  const down = pcts.slice(0, DOWN_MONTHS).reduce((s, p) => s + p, 0);
  const rest = pcts.slice(DOWN_MONTHS).reduce((s, p) => s + p, 0);
  const k = (1 - down) / rest;
  const monthly = pcts.map((p, i) => (i < DOWN_MONTHS ? p : p * k));
  return { id, label, months: monthly.length, downPct: down, pcts: monthly };
});

export const paymentPlanById = new Map(paymentPlans.map((p) => [p.id, p]));

/** First installment date: the 1st of next month (dates are indicative). */
export function firstInstallmentDate(now = new Date()) {
  return new Date(now.getFullYear(), now.getMonth() + 1, 1);
}

/**
 * Full schedule for a price. Amounts are rounded to whole EGP; the last
 * installment absorbs the rounding so the total is exactly the price.
 * kind: 'down' | 'monthly' | 'yearly' (every 12th installment).
 */
export function paymentSchedule(price, planId, start = firstInstallmentDate()) {
  const plan = paymentPlanById.get(planId);
  if (!plan || price == null) return null;
  let paid = 0;
  const items = plan.pcts.map((pct, i) => {
    const last = i === plan.pcts.length - 1;
    const amount = last ? price - paid : Math.round(price * pct);
    paid += amount;
    return {
      n: i + 1,
      date: new Date(start.getFullYear(), start.getMonth() + i, 1),
      pct,
      amount,
      kind: i < DOWN_MONTHS ? 'down' : (i + 1) % 12 === 0 ? 'yearly' : 'monthly',
      year: Math.floor(i / 12) + 1,
    };
  });
  const sumKind = (kind) => items.filter((x) => x.kind === kind);
  const monthly = sumKind('monthly').map((x) => x.amount);
  const yearly = sumKind('yearly').map((x) => x.amount);
  const years = [];
  for (const x of items) (years[x.year - 1] ??= { year: x.year, total: 0, count: 0 }), (years[x.year - 1].total += x.amount), years[x.year - 1].count++;
  return {
    plan,
    items,
    total: price,
    down: sumKind('down').reduce((s, x) => s + x.amount, 0),
    monthlyRange: [Math.min(...monthly), Math.max(...monthly)],
    yearlyRange: [Math.min(...yearly), Math.max(...yearly)],
    years,
    end: items[items.length - 1].date,
  };
}
