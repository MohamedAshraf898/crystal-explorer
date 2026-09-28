import { floors } from './project.js';
import { plans } from './plans.js';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  APARTMENT STATUS & PRICES — edit here
 * ─────────────────────────────────────────────────────────────────────────────
 *  Every apartment is available with "price on request" unless listed below.
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
 * Builds the full apartment list from the floor plans + overrides.
 * @returns {Array<{id:string, floor:number, number:number, area:number, status:string, price:number|null, plan:number, unit:object}>}
 */
function buildApartments() {
  const list = [];
  for (const floor of floors) {
    const plan = plans[floor.plan];
    for (const unit of plan.units) {
      const id = `${floor.level}-${unit.number}`;
      list.push({
        id,
        floor: floor.level,
        number: unit.number,
        area: unit.area,
        status: 'available',
        price: null,
        plan: floor.plan,
        unit,
        ...unitOverrides[id],
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
