/**
 * Tiny event bus shared by the Three.js game systems and the React HUD.
 *  - `emit/on`  : discrete game events (tower repaired, cache found, …)
 *  - `input`    : touch-button state read by the game loop every frame
 *  - `dom`      : HUD nodes the game loop writes to directly (no re-renders)
 */
export function createRoverBus() {
  const listeners = new Map();

  return {
    input: { boost: false, drift: false, grapple: false },
    dom: {},

    on(type, fn) {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type).add(fn);
      return () => listeners.get(type)?.delete(fn);
    },

    emit(type, payload) {
      listeners.get(type)?.forEach((fn) => fn(payload));
    },
  };
}
