import { project } from '../data/project.js';

export const pad2 = (n) => String(n).padStart(2, '0');
export const formatArea = (m2) => `${m2} m²`;
export const formatPrice = (value) =>
  value == null ? 'On request' : `${project.currency} ${new Intl.NumberFormat('en-US').format(value)}`;
export const statusLabel = { available: 'Available', reserved: 'Reserved', sold: 'Sold' };
export const floorLabel = (level) => `Floor ${pad2(level)}`;
/** Compact price, e.g. "EGP 12.8M". */
export const formatPriceShort = (value) => (value == null ? 'On request' : `${project.currency} ${formatMillions(value)}`);
export const formatMillions = (value) => `${(value / 1e6).toFixed(value < 1e7 ? 2 : 1).replace(/\.?0+$/, '')}M`;
export const bedsLabel = (n) => `${n} bed${n === 1 ? '' : 's'}`;
