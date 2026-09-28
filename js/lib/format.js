import { project } from '../data/project.js';

export const pad2 = (n) => String(n).padStart(2, '0');
export const formatArea = (m2) => `${m2} m²`;
export const formatPrice = (value) =>
  value == null ? 'On request' : `${project.currency} ${new Intl.NumberFormat('en-US').format(value)}`;
export const statusLabel = { available: 'Available', reserved: 'Reserved', sold: 'Sold' };
export const floorLabel = (level) => `Floor ${pad2(level)}`;
