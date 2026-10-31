// Contact sheet of a rig's animations (ASSETS §3.5): every pose drawn from the rendered pieces of
// public/assets/units/<rig>/, in a house's colours, into docs/reports/art/<rig>-poses.png, to
// check the joints of a new drawing. Run after pnpm run art: node tools/rig-poses.ts [rig]
import { readFileSync, readdirSync } from 'node:fs';
import { chromium } from 'playwright';
import { parseAnim, parseRig } from '../src/render/rig/format.ts';
import { pieceTransforms, restPose, samplePose } from '../src/render/rig/runtime.ts';

const id = process.argv.slice(2).find((a) => !a.startsWith('--')) ?? 'knight';
/** --rest: the figure at rest alone, large, to look at the joints closely. */
const restOnly = process.argv.includes('--rest');
const root = new URL('../', import.meta.url);
const rigUrl = new URL(`src/content/rigs/${id}/rig.json`, root);
const rig = parseRig(JSON.parse(readFileSync(rigUrl, 'utf8')) as unknown, rigUrl.pathname);
const animDir = new URL(`src/content/rigs/${rig.anims ?? id}/anim/`, root);
const anims = readdirSync(animDir).map((f) =>
  parseAnim(JSON.parse(readFileSync(new URL(f, animDir), 'utf8')) as unknown, rig, f),
);
const art = JSON.parse(readFileSync(new URL('src/content/art.json', root), 'utf8')) as Record<
  string,
  string
>;
const TINT = { primary: '#2c4a8c', secondary: '#b8322a' };

/** One figure, feet at (0, 0), as SVG, the house's pieces multiplied by its colours. */
function figure(pose: ReturnType<typeof restPose>, aim = 0): string {
  void aim;
  const ts = pieceTransforms(rig, pose);
  return rig.pieces
    .map((pc, i) => {
      const t = ts[i];
      const path = art[pc.key];
      if (!t?.visible || !path) return '';
      const href = `data:image/png;base64,${readFileSync(new URL(`public/${path.split('?')[0] ?? ''}`, root)).toString('base64')}`;
      const filter = pc.tint ? ` filter="url(#tint-${pc.tint})"` : '';
      const deg = (t.rotation * 180) / Math.PI;
      return (
        `<g transform="translate(${t.x} ${t.y}) rotate(${deg}) scale(${t.scaleX} ${t.scaleY})">` +
        `<image href="${href}" x="${-pc.pivot[0]}" y="${-pc.pivot[1]}" width="${pc.size[0]}" ` +
        `height="${pc.size[1]}"${filter}/></g>`
      );
    })
    .join('');
}

const cells: { label: string; svg: string }[] = [{ label: 'rest', svg: figure(restPose(rig)) }];
for (const a of restOnly ? [] : anims) {
  const times = a.mode === 'loop' ? [0, a.duration / 3, (2 * a.duration) / 3] : [a.duration];
  for (const t of times) {
    const aims = a.aim.length > 0 ? [-40, 0, 40] : [0];
    for (const deg of aims) {
      const label = `${a.id} ${t.toFixed(2)}s${a.aim.length ? ` aim ${deg}` : ''}`;
      cells.push({ label, svg: figure(samplePose(rig, a, t, deg)) });
    }
  }
}
const COLS = restOnly ? 1 : 8;
const SCALE = restOnly ? 6 : 1.4;
const CW = Math.round(93 * SCALE);
const CH = Math.round(107 * SCALE);
const filters = Object.entries(TINT)
  .map(
    ([k, c]) =>
      `<filter id="tint-${k}" color-interpolation-filters="sRGB"><feFlood flood-color="${c}"/>` +
      `<feComposite in2="SourceAlpha" operator="in"/><feBlend in="SourceGraphic" mode="multiply"/></filter>`,
  )
  .join('');
const body = cells
  .map(
    (c, i) =>
      `<g transform="translate(${(i % COLS) * CW + CW / 2} ${Math.floor(i / COLS) * CH + CH - 22})">` +
      `<line x1="${-CW / 2 + 10}" x2="${CW / 2 - 10}" y1="0" y2="0" stroke="#6b4a2e"/>` +
      `<g transform="scale(${SCALE})">${c.svg}</g>` +
      `<text y="16" text-anchor="middle" font-size="10" font-family="sans-serif">${c.label}</text></g>`,
  )
  .join('');
const w = COLS * CW;
const h = Math.ceil(cells.length / COLS) * CH;
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><defs>${filters}</defs><rect width="100%" height="100%" fill="#e9dcc0"/>${body}</svg>`;
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1.5 });
await page.setContent(`<body style="margin:0">${svg}</body>`);
await page.waitForTimeout(300);
const out = new URL(`docs/reports/art/${id}-${restOnly ? 'rest' : 'poses'}.png`, root);
await page.screenshot({ path: out.pathname.replace(/^\/([A-Za-z]:)/, '$1') });
await browser.close();
console.log(
  `wrote docs/reports/art/${id}-${restOnly ? 'rest' : 'poses'}.png (${cells.length} poses)`,
);
