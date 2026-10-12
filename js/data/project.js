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
 * MINIMAP — the round, GTA-style map at the bottom of the floor page.
 * Drawn locally from OpenStreetMap data (tools/render-map.py): no Google,
 * no live map service. Everything is in real coordinates.
 *   bounds: edges of the map image (Web Mercator)
 *   site:   the building, always in the centre
 *   places: highlighted locations (they stick to the rim when off the map)
 *   kind:   icon — 'mall' | 'promenade' | 'university' | 'hotel' | 'pin'
 *   grow:   size follows the zoom (small when zoomed out, big when zoomed in)
 */
export const minimap = {
  image: 'assets/map/minimap.webp',
  width: 2400,
  height: 2131,
  bounds: { south: 30.807, north: 30.932, west: 28.798, east: 28.962 },
  site: { name: 'Crystal Alamein', lat: 30.8697081, lng: 28.8807809 },
  // turn the map clockwise (degrees): coast straight down, sea on the right
  rotate: 49.7,
  // radius of the circle in km, per zoom step (+ / −); `start` is the index
  radiusKm: [1.5, 3, 4.5, 6.8],
  start: 3,
  places: [
    // grows with zoom: hidden behind the centre arrow when zoomed out
    { name: 'Azur One Eleven Hotel', kind: 'hotel', lat: 30.8697081, lng: 28.8807809, grow: true },
    { name: 'North Square Mall', kind: 'mall', lat: 30.8644332, lng: 28.9321163 },
    { name: 'Alamein Promenade', kind: 'promenade', lat: 30.8599958, lng: 28.9456745 },
    { name: 'AAST El-Alamein', kind: 'university', lat: 30.82835, lng: 28.8802122 },
  ],
  credit: '© OpenStreetMap contributors',
};

/**
 * Building photographs. Each view has one polygon per residential floor
 * (floor 1 → 6), traced on the image in image pixels. The polygons follow the
 * slab lines, including where the facade steps back.
 * To add a view: add the image and trace its floors the same way
 * (open the site with ?debug to see the polygons drawn in red).
 */
export const views = [
  {
    id: 'night',
    label: 'Night',
    image: 'assets/renders/night.webp',
    imageSmall: 'assets/renders/night-sm.webp',
    width: 3935,
    height: 1718,
    floorBands: [
      [[126,1189],[422,1189],[1911,1189],[3232,1186],[3682,1185],[3682,1299],[3232,1301],[1911,1307],[422,1324],[126,1327]], // Floor 1
      [[84,1055],[422,1062],[1911,1096],[3232,1091],[3682,1089],[3682,1185],[3232,1186],[1911,1189],[422,1189],[84,1189]], // Floor 2
      [[84,936],[422,947],[1911,995],[3232,987],[3682,984],[3682,1089],[3232,1091],[1911,1096],[422,1062],[84,1055]], // Floor 3
      [[84,842],[422,852],[1911,894],[3232,883],[3485,880],[3485,985],[3232,987],[1911,995],[422,947],[84,936]], // Floor 4
      [[295,741],[422,745],[1911,787],[3232,773],[3443,771],[3443,881],[3232,883],[1911,894],[422,852],[295,848]], // Floor 5
      [[295,648],[422,652],[1911,697],[3232,680],[3443,678],[3443,771],[3232,773],[1911,787],[422,745],[295,741]], // Floor 6
    ],
  },
  {
    id: 'day',
    label: 'Day',
    image: 'assets/renders/day.webp',
    imageSmall: 'assets/renders/day-sm.webp',
    width: 4000,
    height: 1754,
    floorBands: [
      [[127,1225],[422,1225],[1912,1226],[3233,1223],[3683,1222],[3683,1336],[3233,1338],[1912,1344],[422,1360],[127,1363]], // Floor 1
      [[84,1092],[422,1099],[1912,1133],[3233,1128],[3683,1126],[3683,1222],[3233,1223],[1912,1226],[422,1225],[84,1225]], // Floor 2
      [[84,973],[422,984],[1912,1032],[3234,1024],[3683,1021],[3683,1126],[3233,1128],[1912,1133],[422,1099],[84,1092]], // Floor 3
      [[84,879],[422,889],[1912,931],[3234,920],[3487,918],[3487,1022],[3234,1024],[1912,1032],[422,984],[84,973]], // Floor 4
      [[295,779],[422,782],[1912,825],[3234,811],[3445,809],[3445,918],[3234,920],[1912,931],[422,889],[295,885]], // Floor 5
      [[295,686],[422,690],[1912,735],[3234,718],[3445,715],[3445,809],[3234,811],[1912,825],[422,782],[295,779]], // Floor 6
    ],
  },
];

/** Architectural image shown in the apartment panel. */
export const detailImage = { image: 'assets/renders/street.webp', imageSmall: 'assets/renders/street-sm.webp' };

/** Residential floors and the floor plan each one uses (see plans.js). */
export const floors = [
  { level: 1, name: 'First Floor', plan: 1 },
  { level: 2, name: 'Second Floor', plan: 2 },
  { level: 3, name: 'Third Floor', plan: 2 },
  { level: 4, name: 'Fourth Floor', plan: 3 },
  { level: 5, name: 'Fifth Floor', plan: 4 },
  { level: 6, name: 'Sixth Floor', plan: 4 },
];
