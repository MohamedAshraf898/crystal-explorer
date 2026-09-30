import { apartmentsById } from './data/apartments.js';
import { floors, views } from './data/project.js';

/**
 * Central interaction state + every action.
 *
 * 3D-free version: the building photo, the floor plan, the floor list, the
 * unit list, the breadcrumb and the keyboard all call these same actions, so
 * there is exactly one implementation of each interaction.
 * Listeners receive (state, previous) so the director can pick animations.
 */
export const COMPARE_MAX = 3;

export function createStore() {
  let state = {
    viewMode: 'building', // 'building' | 'floor' | 'apartment'
    view: views[0].id, // which building photo
    selectedFloor: null, // floor level (1..6)
    selectedApartment: null, // apartment id, e.g. '4-17'
    hoveredFloor: null,
    hoveredApartment: null,
    hoverSource: null, // 'pointer' | 'touch' | 'ui'
    filters: { area: null, price: null }, // each [min, max] or null — independent, combinable
    compare: [], // apartment ids picked for side-by-side comparison (max COMPARE_MAX)
    compareOpen: false,
    ready: false,
  };
  const listeners = new Set();
  const floorSet = new Set(floors.map((f) => f.level));

  function set(partial) {
    const prev = state;
    const next = { ...state, ...partial };
    if (Object.keys(partial).every((k) => prev[k] === next[k])) return;
    state = next;
    listeners.forEach((fn) => fn(state, prev));
  }

  const actions = {
    hoverFloor(level, source = 'pointer') {
      if (state.viewMode !== 'building') return;
      if (level != null && !floorSet.has(level)) return;
      set({ hoveredFloor: level, hoverSource: level != null ? source : null });
    },
    hoverApartment(id, source = 'pointer') {
      if (state.viewMode === 'building') return;
      if (id != null && apartmentsById.get(id)?.floor !== state.selectedFloor) return;
      set({ hoveredApartment: id, hoverSource: id != null ? source : null });
    },
    clearHover() {
      set({ hoveredFloor: null, hoveredApartment: null, hoverSource: null });
    },
    selectFloor(level) {
      if (!floorSet.has(level)) return;
      set({ viewMode: 'floor', selectedFloor: level, selectedApartment: null, hoveredFloor: null, hoveredApartment: null, hoverSource: null });
    },
    selectApartment(id) {
      const apt = apartmentsById.get(id);
      if (!apt || apt.status === 'sold') return;
      set({ viewMode: 'apartment', selectedFloor: apt.floor, selectedApartment: id, hoveredFloor: null, hoveredApartment: null, hoverSource: null, compareOpen: false });
    },
    backToFloor() {
      if (state.viewMode === 'apartment') set({ viewMode: 'floor', selectedApartment: null, hoveredApartment: null, hoverSource: null });
    },
    backToBuilding() {
      set({ viewMode: 'building', selectedFloor: null, selectedApartment: null, hoveredFloor: null, hoveredApartment: null, hoverSource: null });
    },
    back() {
      if (state.compareOpen) return actions.closeCompare();
      if (state.viewMode === 'apartment') actions.backToFloor();
      else if (state.viewMode === 'floor') actions.backToBuilding();
    },
    setView(view) {
      if (state.viewMode === 'building') set({ view, hoveredFloor: null, hoverSource: null });
    },
    /** Set one filter ('area' | 'price') to [min, max], or null to switch it off. */
    setFilter(key, range) {
      set({ filters: { ...state.filters, [key]: range } });
    },
    /** Add / remove an apartment from the comparison (ignored when full). */
    toggleCompare(id) {
      if (!apartmentsById.has(id)) return;
      if (state.compare.includes(id)) {
        const compare = state.compare.filter((x) => x !== id);
        set({ compare, compareOpen: state.compareOpen && compare.length > 0 });
      } else if (state.compare.length < COMPARE_MAX) set({ compare: [...state.compare, id] });
    },
    clearCompare() {
      set({ compare: [], compareOpen: false });
    },
    openCompare() {
      if (state.compare.length) set({ compareOpen: true, hoveredApartment: null, hoveredFloor: null, hoverSource: null });
    },
    closeCompare() {
      set({ compareOpen: false });
    },
    clearFilters() {
      set({ filters: { area: null, price: null } });
    },
    setReady() {
      set({ ready: true });
    },
    /**
     * Single entry point for clicks / taps on the photo and the plan.
     * Mouse: click opens. Touch: first tap previews, second tap opens.
     */
    pick(target, pointerType) {
      const touch = pointerType !== 'mouse';
      if (target.type === 'floor') {
        if (touch && state.hoveredFloor !== target.level) actions.hoverFloor(target.level, 'touch');
        else actions.selectFloor(target.level);
      } else if (target.type === 'apartment') {
        const apt = apartmentsById.get(target.id);
        if (!apt) return;
        if (apt.status === 'sold' || (touch && state.hoveredApartment !== target.id && state.selectedApartment !== target.id)) {
          actions.hoverApartment(target.id, touch ? 'touch' : 'pointer');
        } else actions.selectApartment(target.id);
      } else if (state.viewMode === 'apartment') actions.backToFloor();
      else actions.clearHover();
    },
  };

  return {
    get: () => state,
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    actions,
  };
}
