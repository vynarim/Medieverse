// Painted terrain layer (TECH_SPEC §4.3): 512 × 512 CanvasTexture tiles, drawn from the mask in
// the manuscript manner. The flat colours (strata, ashlar, planks) are filled pixel by pixel from
// the mask, so the picture matches it, with the ink and white edges of the strata antialiased
// from their curves; the other lines are drawn in vector over them: the grass along the top of the
// earth with its blades, the rim of the rocks and the ink outline along the contour of the ground
// (marching squares). A carve repaints the area around it. At most 4 tiles are re-uploaded per
// frame (§9).
import Phaser from 'phaser';
import { MASK_PALETTE } from '../content/materials.ts';
import { Material } from '../sim/terrain/material.ts';
import { COLORS } from '../ui/tokens.ts';
import type { MapTheme } from '../content/maps.ts';

export const TILE_SIZE = 512;
export const MAX_TILE_UPLOADS_PER_FRAME = 4;
/** px each tile reaches over its right and bottom neighbours, so no seam shows between them */
const OVERLAP = 1;

/** Read-only view of the collision mask, as exposed by the sim view. */
export interface MaskView {
  readonly width: number;
  readonly height: number;
  readonly data: ArrayLike<number>;
}

type Rgb = readonly [number, number, number];
const rgb = (c: number): Rgb => [(c >> 16) & 255, (c >> 8) & 255, c & 255];

/** Mixes a colour with the vellum, as the illuminators thinned their pigments with white. */
const pale = (c: number, k: number): Rgb => {
  const [r, g, b] = rgb(c);
  const [vr, vg, vb] = rgb(COLORS.ceruse);
  return [r + (vr - r) * k, g + (vg - g) * k, b + (vb - b) * k];
};

/**
 * Tints per material for the stratified ground (ASSETS §1.1: « sol en bandes ondulées
 * stratifiées, rochers en marches arrondies »): the bands cycle through these pigments.
 */
const MATERIAL_RGB: Record<number, readonly Rgb[]> = {
  [Material.Earth]: [
    pale(COLORS.vertTendre, 0.25),
    pale(COLORS.roseGarance, 0.45),
    pale(COLORS.ocre, 0.35),
    pale(COLORS.vertDeGris, 0.35),
  ],
  [Material.Rock]: [pale(COLORS.roche, 0.1), pale(COLORS.azur, 0.35), pale(COLORS.roche, 0.3)],
  [Material.BuiltStone]: [rgb(COLORS.ceruse), pale(COLORS.velin, 0.2)],
  [Material.Wood]: [rgb(COLORS.terreOmbre), pale(COLORS.ocre, 0.1)],
  [Material.Ladder]: [rgb(COLORS.or), rgb(COLORS.ocre)],
  // Masonry behind the play: the same ashlar, a shade darker, so it reads as background.
  [Material.Backdrop]: [pale(COLORS.roche, 0.55), pale(COLORS.velin, 0.05)],
  // Timber behind the play: planks of oak, a shade lighter than the wood one stands on.
  [Material.Timber]: [pale(COLORS.terreOmbre, 0.3), pale(COLORS.ocre, 0.35)],
  // The ice of a frozen lake: pale azure, with whiter streaks.
  [Material.Ice]: [pale(COLORS.azur, 0.3), pale(COLORS.azur, 0.5)],
};
const FALLBACK: readonly Rgb[] = [rgb(COLORS.roseGarance)];
const HIGHLIGHT = rgb(COLORS.ceruse);
const MORTAR = pale(COLORS.terreOmbre, 0.2);
/** px: height of a band of strata, and width of the rounded steps along its edge */
const BAND = 56;
const STEP = 92;
/** px: planks of a wooden tower's body, and the beams across them */
const PLANK = 8;
const BEAM = 40;
/** px: width of the logs of solid wood (a palisade, a wooden walk) */
const STAKE = 10;
/** dark oak of the posts, beams and braces */
const INK_WOOD = pale(COLORS.terreOmbre, 0);
/** px: masonry courses and stones of built stone */
const COURSE = 16;
const STONE = 34;
/** Rounded steps: how far below its nominal line a band edge sits at u in [0, STEP). */
const stepDrop = (u: number): number => {
  const t = (u - STEP / 2) / (STEP / 2);
  return 18 * Math.sqrt(Math.max(0, 1 - t * t));
};
/** Gentle waves (the coast). */
const waveDrop = (u: number): number => 9 + 9 * Math.sin((u / STEP) * Math.PI * 4);
/** Zigzags like wind ripples on a dune (the Holy Land). */
const rippleDrop = (u: number): number => {
  const p = u % (STEP / 2);
  return (Math.abs(p - STEP / 4) * 18) / (STEP / 4);
};
/** Sharp crags (the snowy pass): a steep zigzag, twice as tall on one side. */
const cragDrop = (u: number): number => {
  const p = u % (STEP / 2);
  const rise = STEP / 2 - 12;
  return p < rise ? (p * 18) / rise : ((STEP / 2 - p) * 18) / 12;
};

/** How a map theme paints its ground: strata, top band (grass or sand), stone. */
interface TerrainStyle {
  /** the shape of the strata edges, px below their line at u in [0, STEP): scallops, waves... */
  readonly drop: (u: number) => number;
  /** small marks scattered in the strata (shells, grains of sand); false: plain */
  readonly grain: (x: number, y: number, band: number) => boolean;
  readonly grainRgb?: Rgb;
  readonly tints: Record<number, readonly Rgb[]>;
  /** the band along the top of the earth, in tufts: dark and light */
  readonly top: readonly [Rgb, Rgb];
}

const STYLES: Readonly<Record<MapTheme, TerrainStyle>> = {
  valley: {
    drop: stepDrop,
    grain: () => false,
    tints: MATERIAL_RGB,
    top: [rgb(COLORS.vertDeGris), rgb(COLORS.vertTendre)],
  },
  // Normandy: sand, chalk and salt meadow, dune grass on top.
  coast: {
    drop: waveDrop,
    // Shells and pebbles: little dots in a loose lattice, shifted from band to band.
    grain: (x, y, band) => {
      const u = (x + band * 37) % 46;
      const v = (y + band * 11) % 28;
      return u >= 20 && u < 24 && v >= 12 && v < 15 && ((x >> 5) + band) % 3 !== 0;
    },
    grainRgb: pale(COLORS.terreOmbre, 0.25),
    tints: {
      ...MATERIAL_RGB,
      [Material.Earth]: [
        pale(COLORS.ocre, 0.55),
        pale(COLORS.roche, 0.62),
        pale(COLORS.vertTendre, 0.45),
        pale(COLORS.ocre, 0.35),
        pale(COLORS.ceruse, 0.2),
      ],
      [Material.Rock]: [
        pale(COLORS.roche, 0.25),
        pale(COLORS.lapis, 0.6),
        pale(COLORS.roche, 0.45),
      ],
    },
    top: [pale(COLORS.vertDeGris, 0.15), pale(COLORS.vertTendre, 0.3)],
  },
  // The Holy Land: ochre and rose sand, sandstone walls, a pale sand crust on top.
  holyLand: {
    drop: rippleDrop,
    // Grains of sand: a fine scatter of darker specks.
    grain: (x, y) => (x * 31 + y * 17) % 53 === 0 || (x * 13 + y * 29) % 61 === 0,
    grainRgb: pale(COLORS.terreOmbre, 0.15),
    tints: {
      ...MATERIAL_RGB,
      [Material.Earth]: [
        pale(COLORS.or, 0.45),
        pale(COLORS.roseGarance, 0.55),
        pale(COLORS.ocre, 0.3),
        pale(COLORS.terreOmbre, 0.6),
      ],
      [Material.Rock]: [pale(COLORS.terreOmbre, 0.35), pale(COLORS.roseGarance, 0.4)],
      [Material.BuiltStone]: [pale(COLORS.ocre, 0.55), pale(COLORS.or, 0.6)],
      [Material.Backdrop]: [pale(COLORS.ocre, 0.3), pale(COLORS.terreOmbre, 0.55)],
    },
    top: [pale(COLORS.or, 0.25), pale(COLORS.ceruse, 0.35)],
  },
  // The snowy pass: grey and blue scree under a thick coat of snow, slate-blue rock.
  pass: {
    drop: cragDrop,
    // Flecks of snow caught in the scree.
    grain: (x, y, band) => ((x + band * 29) * 7 + y * 13) % 89 === 0,
    grainRgb: rgb(COLORS.ceruse),
    tints: {
      ...MATERIAL_RGB,
      [Material.Earth]: [
        pale(COLORS.roche, 0.45),
        pale(COLORS.azur, 0.6),
        pale(COLORS.terreOmbre, 0.62),
        pale(COLORS.roche, 0.25),
        pale(COLORS.lapis, 0.7),
      ],
      // Slate, darker than the scree, so a boulder never reads as water.
      [Material.Rock]: [pale(COLORS.roche, 0), pale(COLORS.terreOmbre, 0.45)],
    },
    top: [rgb(COLORS.ceruse), pale(COLORS.azur, 0.8)],
  },
};

/** px: the cracks of the ice: their spacing along the lake, and how far they lean */
const ICE_CRACK = 70;
const ICE_LEAN = 3;

const INK = rgb(COLORS.encre);
/** Mask PNG colours per material, for the debug view of the raw collision mask. */
const MASK_RGB: Record<number, Rgb> = Object.fromEntries(
  MASK_PALETTE.map((c) => [c.material, [c.r, c.g, c.b] as const]),
);
/** px: width of the ink outline (cerne) along every edge with the air, ASSETS §1.1 */
const CERNE = 3.6;
/** px: width of the ink outline of rock against other ground */
const ROCK_RIM = 2.6;
/** px: depth of the grass on top of earth */
const GRASS_DEPTH = 22;
/** columns on each side over which the grass's lower edge is smoothed */
const GRASS_SPAN = 2;
/** px: one blade of lighter grass every so many columns */
const BLADE_EVERY = 5;
/** px: how far around the painted area the contour is traced (more than the outline's half) */
const CONTOUR_MARGIN = 4;
const cssOf = (c: Rgb): string => `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})`;
const INK_CSS = cssOf(INK);
/**
 * Across a strata edge, perpendicular to it, from the curve down: the ink line (as a stroke of
 * 3.4 px one px under the curve), then the white one (3 px).
 */
const INK_TOP = -0.7;
const INK_BOTTOM = 2.7;
const WHITE_BOTTOM = 5.7;
/** steepest slope of a strata edge taken into account for the lines' thickness */
const MAX_SLOPE = 4;
/** Share of a pixel centred at t (1 px wide) that lies in [a, b]. */
const cover = (t: number, a: number, b: number): number =>
  Math.max(0, Math.min(b, t + 0.5) - Math.max(a, t - 0.5));

/**
 * Marching squares, corners on the pixel centres: pushes onto `out` (as x, y, x, y) the segments
 * of the contour between the pixels `inside` says yes and no to, over the cells of
 * [x0, x1] × [y0, y1] (world px).
 */
function contour(
  inside: (x: number, y: number) => boolean,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  out: number[],
): void {
  const w = x1 - x0 + 2;
  let above = new Uint8Array(w);
  let below = new Uint8Array(w);
  for (let i = 0; i < w; i++) above[i] = inside(x0 + i - 1, y0 - 1) ? 1 : 0;
  for (let y = y0; y <= y1 + 1; y++) {
    for (let i = 0; i < w; i++) below[i] = inside(x0 + i - 1, y) ? 1 : 0;
    // The cell between the centres of pixels (x - 1, y - 1) and (x, y): its corners a b / d c.
    const top = y - 0.5;
    const mid = y;
    const bot = y + 0.5;
    for (let i = 0; i < w - 1; i++) {
      const k =
        (above[i] ?? 0) |
        ((above[i + 1] ?? 0) << 1) |
        ((below[i + 1] ?? 0) << 2) |
        ((below[i] ?? 0) << 3);
      if (k === 0 || k === 15) continue;
      const left = x0 + i - 0.5;
      const cx = x0 + i;
      const right = x0 + i + 0.5;
      switch (k) {
        case 1:
        case 14:
          out.push(left, mid, cx, top);
          break;
        case 2:
        case 13:
          out.push(cx, top, right, mid);
          break;
        case 3:
        case 12:
          out.push(left, mid, right, mid);
          break;
        case 4:
        case 11:
          out.push(right, mid, cx, bot);
          break;
        case 6:
        case 9:
          out.push(cx, top, cx, bot);
          break;
        case 7:
        case 8:
          out.push(left, mid, cx, bot);
          break;
        case 5:
          out.push(left, mid, cx, top, right, mid, cx, bot);
          break;
        case 10:
          out.push(cx, top, right, mid, left, mid, cx, bot);
          break;
      }
    }
    [above, below] = [below, above];
  }
}

interface Tile {
  readonly key: string;
  readonly texture: Phaser.Textures.CanvasTexture;
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

export class TerrainLayer {
  private readonly tiles: Tile[] = [];
  /** tile images, so a HUD camera can ignore them */
  readonly images: Phaser.GameObjects.Image[] = [];
  private readonly cols: number;
  /** tile index → dirty rectangle in world px [x0, y0, x1, y1] (inclusive) */
  private readonly dirty = new Map<number, [number, number, number, number]>();

  private readonly mask: () => MaskView;
  /** debug: paint the raw mask colours instead of the greybox look */
  private maskView = false;

  private readonly style: TerrainStyle;

  constructor(scene: Phaser.Scene, mask: () => MaskView, theme: MapTheme = 'valley') {
    this.mask = mask;
    this.style = STYLES[theme];
    const m = mask();
    this.cols = Math.ceil(m.width / TILE_SIZE);
    const rows = Math.ceil(m.height / TILE_SIZE);
    for (let ty = 0; ty < rows; ty++) {
      for (let tx = 0; tx < this.cols; tx++) {
        const x = tx * TILE_SIZE;
        const y = ty * TILE_SIZE;
        const w = Math.min(TILE_SIZE + OVERLAP, m.width - x);
        const h = Math.min(TILE_SIZE + OVERLAP, m.height - y);
        const key = `terrain_tile_${tx}_${ty}`;
        if (scene.textures.exists(key)) scene.textures.remove(key);
        const texture = scene.textures.createCanvas(key, w, h);
        if (!texture) throw new Error(`cannot create canvas texture ${key}`);
        const tile: Tile = { key, texture, x, y, w, h };
        this.tiles.push(tile);
        this.paint(tile, 0, 0, w - 1, h - 1);
        texture.refresh();
        // 512² tiles are powers of two and would REPEAT: their edges would sample the opposite
        // side and draw seams. Clamp; and filter linearly, so the antialiased lines stay smooth under
        // the camera's zoom.
        texture.setWrap(
          Phaser.Textures.WrapMode.CLAMP_TO_EDGE,
          Phaser.Textures.WrapMode.CLAMP_TO_EDGE,
        );
        texture.setFilter(Phaser.Textures.FilterMode.LINEAR);
        this.images.push(scene.add.image(x, y, key).setOrigin(0, 0).setDepth(4));
      }
    }
  }

  /** Debug overlay (F1): shows the raw collision mask, repainted a few tiles per frame. */
  setMaskView(on: boolean): void {
    if (on === this.maskView) return;
    this.maskView = on;
    const m = this.mask();
    this.tiles.forEach((tile, i) =>
      this.dirty.set(i, [
        tile.x,
        tile.y,
        Math.min(m.width - 1, tile.x + tile.w - 1),
        Math.min(m.height - 1, tile.y + tile.h - 1),
      ]),
    );
  }

  /** Marks the area of a carve (px, centre and radius) for repaint. */
  invalidate(cx: number, cy: number, radius: number): void {
    const m = this.mask();
    // The outline and the grass below a crater change too.
    const r = radius + GRASS_DEPTH + CONTOUR_MARGIN;
    const x0 = Math.max(0, cx - r);
    const y0 = Math.max(0, cy - r);
    const x1 = Math.min(m.width - 1, cx + r);
    const y1 = Math.min(m.height - 1, cy + r);
    for (
      let ty = Math.max(0, Math.floor((y0 - OVERLAP) / TILE_SIZE));
      ty <= Math.floor(y1 / TILE_SIZE);
      ty++
    ) {
      for (
        let tx = Math.max(0, Math.floor((x0 - OVERLAP) / TILE_SIZE));
        tx <= Math.floor(x1 / TILE_SIZE);
        tx++
      ) {
        const i = ty * this.cols + tx;
        const d = this.dirty.get(i);
        this.dirty.set(
          i,
          d
            ? [Math.min(d[0], x0), Math.min(d[1], y0), Math.max(d[2], x1), Math.max(d[3], y1)]
            : [x0, y0, x1, y1],
        );
      }
    }
  }

  /** Repaints and re-uploads at most MAX_TILE_UPLOADS_PER_FRAME dirty tiles. */
  flush(): number {
    let uploads = 0;
    for (const [i, [x0, y0, x1, y1]] of this.dirty) {
      if (uploads === MAX_TILE_UPLOADS_PER_FRAME) break;
      this.dirty.delete(i);
      const tile = this.tiles[i];
      if (!tile) continue;
      this.paint(
        tile,
        Math.max(0, x0 - tile.x),
        Math.max(0, y0 - tile.y),
        Math.min(tile.w - 1, x1 - tile.x),
        Math.min(tile.h - 1, y1 - tile.y),
      );
      tile.texture.refresh();
      uploads++;
    }
    return uploads;
  }

  get pendingTiles(): number {
    return this.dirty.size;
  }

  /** Paints a tile rectangle (tile-local px, inclusive) from the mask. */
  private paint(tile: Tile, lx0: number, ly0: number, lx1: number, ly1: number): void {
    if (lx1 < lx0 || ly1 < ly0) return;
    const m = this.mask();
    const ctx = tile.texture.getContext();
    const w = lx1 - lx0 + 1;
    const h = ly1 - ly0 + 1;
    const img = ctx.createImageData(w, h);
    // The strata edge of the band row being filled, column by column: where its curve passes
    // (y, px), and how its slope thins the lines measured straight down (cos).
    const edgeY = new Float32Array(w);
    const edgeCos = new Float32Array(w);
    let edgeRow = Number.NaN;
    // The grass: px of ground from the air above down to each pixel of the row, over the columns
    // of the rectangle and GRASS_SPAN beyond; counted from GRASS_DEPTH px over the rectangle.
    const depth = new Int16Array(w + 2 * GRASS_SPAN);
    const countDepth = (wy: number): void => {
      for (let i = 0; i < depth.length; i++) {
        const x = tile.x + lx0 + i - GRASS_SPAN;
        const solid =
          x >= 0 &&
          x < m.width &&
          wy >= 0 &&
          wy < m.height &&
          (m.data[wy * m.width + x] ?? 0) !== 0;
        depth[i] = solid ? Math.min((depth[i] ?? 0) + 1, GRASS_DEPTH + 9) : 0;
      }
    };
    for (let wy = tile.y + ly0 - GRASS_DEPTH - 2; wy < tile.y + ly0; wy++) countDepth(wy);
    const [grassDark] = this.style.top;
    for (let ly = 0; ly < h; ly++) {
      const wy = tile.y + ly0 + ly;
      countDepth(wy);
      const row = Math.floor(wy / BAND);
      if (row !== edgeRow) {
        edgeRow = row;
        const shift = (((row * 23) % STEP) + STEP) % STEP;
        const at = (x: number): number =>
          row * BAND + BAND - 38 + this.style.drop((((x + shift) % STEP) + STEP) % STEP);
        for (let lx = 0; lx < w; lx++) {
          const cx = tile.x + lx0 + lx + 0.5;
          const slope = Math.max(-MAX_SLOPE, Math.min(MAX_SLOPE, (at(cx + 1) - at(cx - 1)) / 2));
          edgeY[lx] = at(cx);
          edgeCos[lx] = 1 / Math.sqrt(1 + slope * slope);
        }
      }
      for (let lx = 0; lx < w; lx++) {
        const wx = tile.x + lx0 + lx;
        const mat = m.data[wy * m.width + wx] ?? 0;
        const o = (ly * w + lx) * 4;
        if (mat === Material.Air) continue; // alpha stays 0
        let c: Rgb;
        if (this.maskView) c = MASK_RGB[mat] ?? INK;
        else if (mat === Material.BuiltStone || mat === Material.Backdrop) {
          // Ashlar: courses of dressed stones, mortar joints, a lighter top edge to each stone.
          const course = Math.floor(wy / COURSE);
          const sx = (wx + (course & 1) * (STONE >> 1)) % STONE;
          const sy = wy % COURSE;
          const tints = this.style.tints[mat] ?? FALLBACK;
          const tint =
            tints[(course + Math.floor((wx + (course & 1) * 17) / STONE)) % tints.length];
          if (sx < 2 || sy < 2) c = MORTAR;
          else if (sy < 4) c = HIGHLIGHT;
          else c = tint ?? HIGHLIGHT;
        } else if (mat === Material.Wood) {
          // Upright logs, a dark split between each.
          const tints = this.style.tints[mat] ?? FALLBACK;
          const log = Math.floor(wx / STAKE);
          c = wx % STAKE < 2 ? INK_WOOD : (tints[log % tints.length] ?? HIGHLIGHT);
        } else if (mat === Material.Ice) {
          // Ice: pale bands lying flat, a white glint along its top, slanting cracks in ink.
          const tints = this.style.tints[mat] ?? FALLBACK;
          const u = (((wx + wy * ICE_LEAN) % ICE_CRACK) + ICE_CRACK) % ICE_CRACK;
          if (wy < 5 || (m.data[(wy - 5) * m.width + wx] ?? 0) === Material.Air) c = HIGHLIGHT;
          else if (u < 2 && (wx >> 6) % 3 !== 1) c = INK;
          else c = tints[(wy >> 2) % tints.length] ?? HIGHLIGHT;
        } else if (mat === Material.Timber) {
          // Timber framing, as the wooden keeps and hoardings were built: square panels of
          // planks between dark posts and beams, each braced by a Saint Andrew's cross.
          const tints = this.style.tints[mat] ?? FALLBACK;
          const u = ((wx % BEAM) + BEAM) % BEAM;
          const v = ((wy % BEAM) + BEAM) % BEAM;
          const frame = u < 5 || v < 5;
          const brace = Math.abs(u - v) < 4 || Math.abs(u + v - BEAM) < 4;
          if (frame || brace) c = INK_WOOD;
          else if (u % PLANK < 1) c = MORTAR;
          else c = tints[Math.floor(wy / BEAM + wx / PLANK) % tints.length] ?? HIGHLIGHT;
        } else {
          // Strata in rounded steps: each band's lower edge bulges in arcs, an ink line on the
          // edge, a white one just under it, as on the hills of the manuscript; the lines are
          // antialiased from the curve, measured across it.
          const tints = this.style.tints[mat] ?? FALLBACK;
          const tint = (band: number): Rgb => {
            const base = tints[((band % tints.length) + tints.length) % tints.length] ?? HIGHLIGHT;
            return this.style.grain(wx, wy, band) ? (this.style.grainRgb ?? INK) : base;
          };
          const t = (wy + 0.5 - (edgeY[lx] ?? 0)) * (edgeCos[lx] ?? 1);
          if (t < INK_TOP - 0.5) c = tint(row);
          else if (t > WHITE_BOTTOM + 0.5) c = tint(row + 1);
          else {
            const above = cover(t, -Infinity, INK_TOP);
            const ink = cover(t, INK_TOP, INK_BOTTOM);
            const white = cover(t, INK_BOTTOM, WHITE_BOTTOM);
            const below = cover(t, WHITE_BOTTOM, Infinity);
            const a = tint(row);
            const b = tint(row + 1);
            const mix = (k: 0 | 1 | 2): number =>
              a[k] * above + INK[k] * ink + HIGHLIGHT[k] * white + b[k] * below;
            c = [mix(0), mix(1), mix(2)];
          }
        }
        if (mat === Material.Earth && !this.maskView) {
          // Grass down to GRASS_DEPTH px under the surface; its lower edge follows the surface
          // averaged over a few columns, antialiased, so a steep slope leaves no stairs in it.
          const d = depth[lx + GRASS_SPAN] ?? 0;
          if (d <= GRASS_DEPTH + 6) {
            let sum = 0;
            let n = 0;
            for (let k = 0; k <= 2 * GRASS_SPAN; k++) {
              const dk = depth[lx + k] ?? 0;
              if (dk > 0 && Math.abs(dk - d) <= 6) {
                sum += dk;
                n++;
              }
            }
            const g = Math.max(0, Math.min(1, GRASS_DEPTH + 0.5 - sum / n));
            if (g > 0) {
              const mix = (k: 0 | 1 | 2): number => c[k] + (grassDark[k] - c[k]) * g;
              c = [mix(0), mix(1), mix(2)];
            }
          }
        }
        img.data[o] = c[0];
        img.data[o + 1] = c[1];
        img.data[o + 2] = c[2];
        img.data[o + 3] = 255;
      }
    }
    ctx.putImageData(img, lx0, ly0);
    if (!this.maskView) this.drawLines(ctx, tile, lx0, ly0, w, h);
  }

  /**
   * The vector lines over a rectangle just filled (tile-local lx0, ly0, w × h px), drawn on the
   * tile itself, inside the rectangle: the grass over the ground there, then the ink of the rocks
   * and of the outline.
   */
  private drawLines(
    ctx: CanvasRenderingContext2D,
    tile: Tile,
    lx0: number,
    ly0: number,
    w: number,
    h: number,
  ): void {
    const m = this.mask();
    const matAt = (x: number, y: number): number =>
      x >= 0 && y >= 0 && x < m.width && y < m.height ? (m.data[y * m.width + x] ?? 0) : 0;
    const solidAt = (x: number, y: number): boolean => matAt(x, y) !== Material.Air;
    /** px of earth under the surface at (x, y), up to GRASS_DEPTH: how deep the grass goes. */
    const earthDepth = (x: number, y: number): number => {
      const col = Math.floor(x);
      const top = Math.ceil(y);
      let k = 0;
      while (k < GRASS_DEPTH && matAt(col, top + k) === Material.Earth) k++;
      return k;
    };
    const wx0 = tile.x + lx0;
    const wy0 = tile.y + ly0;
    const wx1 = wx0 + w - 1;
    const wy1 = wy0 + h - 1;
    ctx.save();
    ctx.beginPath();
    ctx.rect(lx0, ly0, w, h);
    ctx.clip();
    ctx.translate(-tile.x, -tile.y);
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    // The contour of the ground, a little beyond the rectangle, and from GRASS_DEPTH px over it:
    // the grass under a surface up there reaches down into it.
    const ground: number[] = [];
    contour(
      solidAt,
      wx0 - CONTOUR_MARGIN,
      wy0 - GRASS_DEPTH - CONTOUR_MARGIN,
      wx1 + CONTOUR_MARGIN,
      wy1 + CONTOUR_MARGIN,
      ground,
    );

    // Blades of a lighter green in the grass (filled with the ground), under each stretch of the
    // contour with the air above and earth below; laid only on the ground just filled.
    ctx.globalCompositeOperation = 'source-atop';
    const light = this.style.top[1];
    const blades: number[] = [];
    for (let i = 0; i < ground.length; i += 4) {
      const ax = ground[i] ?? 0;
      const ay = ground[i + 1] ?? 0;
      const bx = ground[i + 2] ?? 0;
      const by = ground[i + 3] ?? 0;
      const mx = (ax + bx) / 2;
      const my = (ay + by) / 2;
      const col = Math.floor(mx);
      if (ax === bx || ((col % BLADE_EVERY) + BLADE_EVERY) % BLADE_EVERY !== 0) continue;
      if (solidAt(col, Math.floor(my - 1)) || matAt(col, Math.floor(my + 1)) !== Material.Earth) {
        continue;
      }
      blades.push(mx, my, earthDepth(mx, my));
    }
    ctx.strokeStyle = cssOf(light);
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    for (let i = 0; i < blades.length; i += 3) {
      const x = blades[i] ?? 0;
      const y = (blades[i + 1] ?? 0) + 3;
      const hash = Math.imul(Math.floor(x), 2654435761) >>> 0;
      const len = Math.min(7 + (hash % 9), (blades[i + 2] ?? 0) - 5);
      if (len < 3) continue;
      const lean = ((hash >>> 8) % 5) - 2;
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo(x + lean * 0.2, y + len * 0.6, x + lean, y + len);
    }
    ctx.stroke();
    ctx.globalCompositeOperation = 'source-over';

    // The ink: the rim of the rocks against other ground, then the outline against the air.
    const rocks: number[] = [];
    contour(
      (x, y) => matAt(x, y) === Material.Rock,
      wx0 - CONTOUR_MARGIN,
      wy0 - CONTOUR_MARGIN,
      wx1 + CONTOUR_MARGIN,
      wy1 + CONTOUR_MARGIN,
      rocks,
    );
    ctx.strokeStyle = INK_CSS;
    for (const [segments, width] of [
      [rocks, ROCK_RIM],
      [ground, CERNE],
    ] as const) {
      if (segments.length === 0) continue;
      ctx.beginPath();
      for (let i = 0; i < segments.length; i += 4) {
        ctx.moveTo(segments[i] ?? 0, segments[i + 1] ?? 0);
        ctx.lineTo(segments[i + 2] ?? 0, segments[i + 3] ?? 0);
      }
      ctx.lineWidth = width;
      ctx.stroke();
    }
    ctx.restore();
  }
}
