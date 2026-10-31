// A tablet or a phone is played held sideways only (GDD §8; phones too since 2026-11-01): the
// installed app locks the screen in landscape, and wherever the lock is refused (a browser tab),
// held upright it is asked to turn.
import { t } from '../ui/i18n.ts';
import { el, uiRoot } from '../ui/overlay.ts';

function isTouchScreen(): boolean {
  return window.matchMedia('(pointer: coarse)').matches;
}

function lockLandscape(): void {
  const o = window.screen.orientation as ScreenOrientation & {
    lock?: (o: 'landscape') => Promise<void>;
  };
  // Refused outside full screen or an installed app: the veil below then asks for it.
  o.lock?.('landscape').catch(() => undefined);
}

export function watchOrientation(): void {
  if (!isTouchScreen()) return;
  lockLandscape();
  // Entering full screen makes the lock possible in a browser tab too.
  document.addEventListener('fullscreenchange', lockLandscape);
  const veil = el('div', 'rotate panel hidden');
  veil.append(el('h2', '', t('rotate.title')), el('p', '', t('rotate.text')));
  uiRoot().append(veil);
  const fit = (): void => {
    veil.classList.toggle('hidden', window.innerWidth >= window.innerHeight);
  };
  fit();
  window.addEventListener('resize', fit);
}
