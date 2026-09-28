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
export function createStore() {
  let state = {
    viewMode: 'building', // 'building' | 'floor' | 'apartment'
    view: views[0].id, // which building photo
    selectedFloor: null, // floor level (1..6)
    selectedApartment: null, // apartment id, e.g. '4-17'
    hoveredFloor: null,
    hoveredApartment: null,
    hoverSource: null, // 'pointer' | 'touch' | 'ui'
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
      set({ viewMode: 'apartment', selectedFloor: apt.floor, selectedApartment: id, hoveredFloor: null, hoveredApartment: null, hoverSource: null });
    },
    backToFloor() {
      if (state.viewMode === 'apartment') set({ viewMode: 'floor', selectedApartment: null, hoveredApartment: null, hoverSource: null });
    },
    backToBuilding() {
      set({ viewMode: 'building', selectedFloor: null, selectedApartment: null, hoveredFloor: null, hoveredApartment: null, hoverSource: null });
    },
    back() {
      if (state.viewMode === 'apartment') actions.backToFloor();
      else if (state.viewMode === 'floor') actions.backToBuilding();
    },
    setView(view) {
      if (state.viewMode === 'building') set({ view, hoveredFloor: null, hoverSource: null });
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
