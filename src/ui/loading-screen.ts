// The wait between « À la bataille ! » and the first frame of the battle: the map is drawn and
// the scene built, which takes a few seconds on a tablet. A panel says so instead of a black screen.
import { el, uiRoot } from './overlay.ts';
import { t } from './i18n.ts';

let shown: (() => void) | null = null;

/** Shows the loading panel, until hideLoading (the battle scene's first frame). */
export function showLoading(): void {
  hideLoading();
  const veil = el('div', 'veil');
  const box = el('div', 'banner panel');
  box.append(el('div', 'big', t('loading.title')), el('div', 'quip', t('loading.text')));
  uiRoot().append(veil, box);
  shown = () => {
    veil.remove();
    box.remove();
  };
}

/** Removes the loading panel, if it is up. */
export function hideLoading(): void {
  shown?.();
  shown = null;
}

/** Resolves once the browser has painted what is on screen (two frames). */
export function painted(): Promise<void> {
  return new Promise((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
  );
}
