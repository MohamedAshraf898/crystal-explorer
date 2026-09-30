import { layouts } from './layouts.js';
import { floors } from './project.js';
import { plans } from './plans.js';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  APARTMENT STATUS & PRICES — edit here
 * ─────────────────────────────────────────────────────────────────────────────
 *  Every apartment is available at its ESTIMATED price (see `pricing`) unless
 *  listed below. An override price is shown as the real price, not an estimate.
 *  Key format: "<floor>-<apartment number>", e.g. '4-17' = Apartment 17, Floor 4.
 *
 *  status: 'available' | 'reserved' | 'sold'
 *  price:  number in EGP, or null for "On request"
 */
export const unitOverrides = {
  // '1-3':  { status: 'sold' },
  // '4-17': { status: 'reserved', price: 18500000 },
};

/**
 * ESTIMATED PRICES — a simple, editable model (EGP). Not official prices.
 *   built-up area × perM2 × floor factor
 *   + private garden m² × perM2 × garden   (ground floor)
 *   + roof terrace m² × perM2 × roofTerrace (penthouse terraces)
 *   + pool (private plunge pool)
 * rounded to the nearest `round`.
 */
export const pricing = {
  perM2: 115000,
  floorFactor: { 1: 1.0, 2: 1.0, 3: 1.015, 4: 1.03, 5: 1.045, 6: 1.06 },
  garden: 0.35,
  roofTerrace: 0.4,
  pool: 1500000,
  round: 50000,
};

export function estimatePrice(area, floor, layout) {
  const p = pricing;
  const base = area * p.perM2 * (p.floorFactor[floor] ?? 1);
  const extras = (layout?.garden ?? 0) * p.perM2 * p.garden + (layout?.roofTerrace ?? 0) * p.perM2 * p.roofTerrace + (layout?.pool ? p.pool : 0);
  return Math.round((base + extras) / p.round) * p.round;
}

/**
 * Builds the full apartment list from the floor plans + overrides.
 * @returns {Array<{id:string, floor:number, number:number, area:number, status:string, price:number|null, estimated:boolean, plan:number, unit:object, layout:object}>}
 */
function buildApartments() {
  const list = [];
  for (const floor of floors) {
    const plan = plans[floor.plan];
    for (const unit of plan.units) {
      const id = `${floor.level}-${unit.number}`;
      const layout = layouts[floor.plan][unit.number];
      const override = unitOverrides[id] ?? {};
      list.push({
        id,
        floor: floor.level,
        number: unit.number,
        area: unit.area,
        status: 'available',
        price: estimatePrice(unit.area, floor.level, layout),
        estimated: !('price' in override),
        plan: floor.plan,
        unit,
        layout,
        ...override,
      });
    }
  }
  return list;
}

export const apartments = buildApartments();
export const apartmentsById = new Map(apartments.map((a) => [a.id, a]));
export const apartmentsByFloor = new Map(floors.map((f) => [f.level, apartments.filter((a) => a.floor === f.level)]));

export function floorSummary(level) {
  const list = apartmentsByFloor.get(level) ?? [];
  const areas = list.map((a) => a.area);
  return {
    total: list.length,
    available: list.filter((a) => a.status === 'available').length,
    minArea: Math.min(...areas),
    maxArea: Math.max(...areas),
  };
}

/** Full ranges over the whole building (bounds for the filters). */
const priced = apartments.filter((a) => a.price != null).map((a) => a.price);
export const ranges = {
  area: [Math.min(...apartments.map((a) => a.area)), Math.max(...apartments.map((a) => a.area))],
  price: [Math.min(...priced), Math.max(...priced)],
};

/**
 * Does an apartment pass the filters? Each filter is independent:
 * `filters.area` / `filters.price` are [min, max] or null (= not filtering).
 */
export function matchesFilters(apt, filters) {
  const { area, price } = filters ?? {};
  if (area && (apt.area < area[0] || apt.area > area[1])) return false;
  if (price && (apt.price == null || apt.price < price[0] || apt.price > price[1])) return false;
  return true;
}

export const hasFilters = (filters) => Boolean(filters?.area || filters?.price);
