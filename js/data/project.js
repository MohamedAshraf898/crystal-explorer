/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  PROJECT DATA — Crystal Alamein
 * ─────────────────────────────────────────────────────────────────────────────
 *  Everything about the building that isn't geometry lives here.
 *  Apartment status / price overrides are in apartments.js.
 */

export const project = {
  name: 'Crystal',
  location: 'Alamein',
  country: 'Egypt',
  developer: 'Darak Developments',
  partners: ['UZ', 'Darak Developments', 'Azur Hospitality'],
  hotline: '17423',
  website: 'https://darak-group.com',
  websiteLabel: 'darak-group.com',
  currency: 'EGP',
  delivery: '2026',
};

/**
 * Building photographs. Each view defines where the residential floors sit on
 * the image (in image pixels): the facade's left / right edge and the slab
 * lines from the bottom of floor 1 up to the roof soffit (7 values → 6 floors).
 * To add a view: add the image and measure its slab lines the same way.
 */
export const views = [
  {
    id: 'day',
    label: 'Day',
    image: 'assets/renders/day.webp',
    imageSmall: 'assets/renders/day-sm.webp',
    width: 4000,
    height: 2273,
    left: 109,
    right: 3920,
    slabs: [1671, 1460, 1257, 1057, 860, 663, 503],
  },
  {
    id: 'night',
    label: 'Night',
    image: 'assets/renders/night.webp',
    imageSmall: 'assets/renders/night-sm.webp',
    width: 4000,
    height: 2250,
    left: 114,
    right: 3914,
    slabs: [1649, 1446, 1249, 1051, 846, 651, 471],
  },
  {
    id: 'pool',
    label: 'Pool side',
    image: 'assets/renders/pool.webp',
    imageSmall: 'assets/renders/pool-sm.webp',
    width: 3997,
    height: 2248,
    left: 177,
    right: 3811,
    slabs: [1756, 1559, 1365, 1179, 999, 822, 642],
  },
];

/** Architectural detail image shown in the apartment panel. */
export const detailImage = { image: 'assets/renders/detail.webp', imageSmall: 'assets/renders/detail-sm.webp' };

/** Residential floors and the floor plan each one uses (see plans.js). */
export const floors = [
  { level: 1, name: 'First Floor', plan: 1 },
  { level: 2, name: 'Second Floor', plan: 2 },
  { level: 3, name: 'Third Floor', plan: 2 },
  { level: 4, name: 'Fourth Floor', plan: 3 },
  { level: 5, name: 'Fifth Floor', plan: 4 },
  { level: 6, name: 'Sixth Floor', plan: 4 },
];
