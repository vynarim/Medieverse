// Fps probe (BACKLOG 2.1, TECH_SPEC §9): a visible Chromium window, GPU on, plays AI against AI
// while the page records every frame's interval. Usage: pnpm run perf:fps [dev server URL] [minutes]
// with `pnpm run dev` running. Leave the window in front and the computer alone meanwhile: a
// window covered or minimised is throttled to 1 frame a second, and the run says so.
import { chromium } from 'playwright';

const url = process.argv.slice(2).find((a) => a.startsWith('http')) ?? 'http://localhost:5173/';
const minutes = Number(process.argv.slice(2).find((a) => /^\d+$/.test(a)) ?? 10);
const log = (...a: unknown[]): void => console.log(new Date().toISOString().slice(11, 19), ...a);

const browser = await chromium.launch({
  headless: false,
  args: [
    '--start-maximized',
    '--disable-backgrounding-occluded-windows',
    '--disable-renderer-backgrounding',
    '--disable-background-timer-throttling',
    '--disable-features=CalculateNativeWinOcclusion',
  ],
});
const ctx = await browser.newContext({ viewport: null });
const page = await ctx.newPage();
const errors: string[] = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text());
});
await page.addInitScript(() => {
  if (sessionStorage.getItem('probe')) return;
  sessionStorage.setItem('probe', '1');
  localStorage.removeItem('medieverse.save.v1');
  localStorage.setItem(
    'medieverse.setup.v1',
    JSON.stringify({
      map: 'valley',
      scheme: 'classic',
      regicide: false,
      lineups: [
        ['knight', 'archer', 'slinger', 'cleric'],
        ['knight', 'archer', 'slinger', 'cleric'],
      ],
      turnSeconds: 45,
      players: ['knight', 'knight'],
    }),
  );
});
await page.goto(url);
await page.locator('#ui button.fire').first().click();
await page.locator('#ui .setup button.fire').first().click();
await page.waitForFunction(() => {
  const g = (window as unknown as { medieverse?: { scene: { getScene(k: string): unknown } } })
    .medieverse;
  return !!(g?.scene.getScene('battle') as { sim?: unknown } | undefined)?.sim;
});
const size = await page.evaluate(() => [innerWidth, innerHeight, devicePixelRatio]);
log('battle started, viewport', size);
await page.evaluate(() => {
  const w = window as unknown as { frames_: number[] };
  w.frames_ = [];
  let last = performance.now();
  const loop = (t: number): void => {
    w.frames_.push(t - last);
    last = t;
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
});

const perMinute: {
  minute: number;
  fps: number;
  p50: number;
  p99: number;
  max: number;
  over20: number;
  tick: number;
  turn: number;
}[] = [];
const all: number[] = [];
for (let m = 1; m <= minutes; m++) {
  await page.waitForTimeout(60_000);
  const r = await page.evaluate(() => {
    const w = window as unknown as {
      frames_: number[];
      medieverse: { scene: { getScene(k: string): unknown } };
    };
    const f = w.frames_.splice(0);
    const sc = w.medieverse.scene.getScene('battle') as {
      sim?: { view(): { tick: number; turn: { number: number } } };
    } | null;
    const v = sc?.sim?.view();
    return { f, tick: v?.tick ?? -1, turn: v?.turn.number ?? -1 };
  });
  const s = [...r.f].sort((a, b) => a - b);
  const q = (p: number): number => s[Math.min(s.length - 1, Math.floor(p * s.length))] ?? 0;
  all.push(...r.f);
  const row = {
    minute: m,
    fps: +(r.f.length / (r.f.reduce((a, b) => a + b, 0) / 1000)).toFixed(1),
    p50: +q(0.5).toFixed(2),
    p99: +q(0.99).toFixed(2),
    max: +(s.at(-1) ?? 0).toFixed(1),
    over20: r.f.filter((x) => x > 20).length,
    tick: r.tick,
    turn: r.turn,
  };
  perMinute.push(row);
  log(JSON.stringify(row));
}
// A throttled window (covered, minimised) draws about 1 frame a second: the run is void.
if (perMinute.some((m) => m.fps < 30))
  console.log('VOID: the window was throttled (covered or minimised)');
const s = [...all].sort((a, b) => a - b);
const q = (p: number): number => s[Math.min(s.length - 1, Math.floor(p * s.length))] ?? 0;
console.log(
  JSON.stringify({
    frames: all.length,
    fps: +(all.length / (all.reduce((a, b) => a + b, 0) / 1000)).toFixed(1),
    p50: q(0.5),
    p99: q(0.99),
    p999: q(0.999),
    max: s.at(-1),
    over20: all.filter((x) => x > 20).length,
    over33: all.filter((x) => x > 33.4).length,
    errors,
  }),
);
await browser.close();
