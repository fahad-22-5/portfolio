/**
 * "Stealth Mode" easter egg — a dark monochrome theme toggled by the classic
 * ↑ ↑ ↓ ↓ ← → ← → B A sequence (or by toggleStealth() from any secret button).
 * State lives on <html data-theme="stealth"> so plain CSS and the 3D rover
 * game can both react to it.
 */
import { useEffect, useState } from 'react';

const EVENT = 'rover:stealth';
const SEQUENCE = ['arrowup', 'arrowup', 'arrowdown', 'arrowdown', 'arrowleft', 'arrowright', 'arrowleft', 'arrowright', 'b', 'a'];

export const isStealth = () => document.documentElement.dataset.theme === 'stealth';

export function setStealth(on) {
  if (on) document.documentElement.dataset.theme = 'stealth';
  else delete document.documentElement.dataset.theme;
  window.dispatchEvent(new CustomEvent(EVENT, { detail: on }));
}

export const toggleStealth = () => setStealth(!isStealth());

export function onStealthChange(listener) {
  const handler = (e) => listener(e.detail);
  window.addEventListener(EVENT, handler);
  return () => window.removeEventListener(EVENT, handler);
}

/** Mount once near the app root. */
export function useKonamiStealth() {
  useEffect(() => {
    let progress = 0;
    const onKeyDown = (e) => {
      const key = e.key.toLowerCase();
      progress = key === SEQUENCE[progress] ? progress + 1 : (key === SEQUENCE[0] ? 1 : 0);
      if (progress === SEQUENCE.length) {
        progress = 0;
        toggleStealth();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);
}

/** Reactive read of the current theme. */
export function useStealth() {
  const [on, setOn] = useState(isStealth);
  useEffect(() => onStealthChange(setOn), []);
  return on;
}
