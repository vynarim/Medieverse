// The battle's figures as SVG, for the pages outside the battle (the help): the drawn figures of
// the classes (assets/units/<class>/<class>.svg, the rigs' source) at rest, their house's pieces
// tinted as the battle tints them; for a class with no drawing, the drawing code of figures.ts
// and class-marks.ts, played on a small recorder that answers the few Graphics calls they make
// and writes SVG elements instead of filling a Phaser canvas.
import type Phaser from 'phaser';
import type { ClassId } from '../content/classes.ts';
import { drawClassMark } from './class-marks.ts';
import { drawFigure, drawNimbus } from './figures.ts';
import { RIGS } from './rig/rigs.ts';

/** The drawn figures, by path: the very sources the rigs' pieces are cut from. */
const ART = import.meta.glob<string>('../../assets/units/*/*.svg', {
  query: '?raw',
  import: 'default',
  eager: true,
});

type Pt = { readonly x: number; readonly y: number };

const hex = (c: number): string => `#${(c & 0xffffff).toString(16).padStart(6, '0')}`;
const n = (v: number): string => (Math.round(v * 10) / 10).toString();

/** Answers the Graphics calls of the figures, as SVG markup. */
class SvgPen {
  private fill = '#000';
  private fillAlpha = 1;
  private stroke = '#000';
  private strokeAlpha = 1;
  private width = 1;
  private path = '';
  readonly parts: string[] = [];

  private get f(): string {
    return `fill="${this.fill}"${this.fillAlpha < 1 ? ` fill-opacity="${n(this.fillAlpha)}"` : ''}`;
  }

  private get s(): string {
    return `fill="none" stroke="${this.stroke}" stroke-width="${n(this.width)}" stroke-linejoin="round" stroke-linecap="round"${
      this.strokeAlpha < 1 ? ` stroke-opacity="${n(this.strokeAlpha)}"` : ''
    }`;
  }

  fillStyle(color: number, alpha = 1): this {
    this.fill = hex(color);
    this.fillAlpha = alpha;
    return this;
  }

  lineStyle(width: number, color: number, alpha = 1): this {
    this.width = width;
    this.stroke = hex(color);
    this.strokeAlpha = alpha;
    return this;
  }

  fillCircle(x: number, y: number, r: number): this {
    this.parts.push(`<circle cx="${n(x)}" cy="${n(y)}" r="${n(r)}" ${this.f}/>`);
    return this;
  }

  strokeCircle(x: number, y: number, r: number): this {
    this.parts.push(`<circle cx="${n(x)}" cy="${n(y)}" r="${n(r)}" ${this.s}/>`);
    return this;
  }

  fillEllipse(x: number, y: number, w: number, h: number): this {
    this.parts.push(
      `<ellipse cx="${n(x)}" cy="${n(y)}" rx="${n(w / 2)}" ry="${n(h / 2)}" ${this.f}/>`,
    );
    return this;
  }

  fillRect(x: number, y: number, w: number, h: number): this {
    this.parts.push(
      `<rect x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}" ${this.f}/>`,
    );
    return this;
  }

  strokeRect(x: number, y: number, w: number, h: number): this {
    this.parts.push(
      `<rect x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}" ${this.s}/>`,
    );
    return this;
  }

  private points(p: readonly Pt[]): string {
    return p.map((q) => `${n(q.x)},${n(q.y)}`).join(' ');
  }

  fillPoints(p: readonly Pt[]): this {
    this.parts.push(`<polygon points="${this.points(p)}" ${this.f}/>`);
    return this;
  }

  strokePoints(p: readonly Pt[], closeShape = false): this {
    const tag = closeShape ? 'polygon' : 'polyline';
    this.parts.push(`<${tag} points="${this.points(p)}" ${this.s}/>`);
    return this;
  }

  fillTriangle(x1: number, y1: number, x2: number, y2: number, x3: number, y3: number): this {
    return this.fillPoints([
      { x: x1, y: y1 },
      { x: x2, y: y2 },
      { x: x3, y: y3 },
    ]);
  }

  strokeTriangle(x1: number, y1: number, x2: number, y2: number, x3: number, y3: number): this {
    return this.strokePoints(
      [
        { x: x1, y: y1 },
        { x: x2, y: y2 },
        { x: x3, y: y3 },
      ],
      true,
    );
  }

  lineBetween(x1: number, y1: number, x2: number, y2: number): this {
    this.parts.push(`<line x1="${n(x1)}" y1="${n(y1)}" x2="${n(x2)}" y2="${n(y2)}" ${this.s}/>`);
    return this;
  }

  beginPath(): this {
    this.path = '';
    return this;
  }

  arc(x: number, y: number, r: number, a0: number, a1: number, anticlockwise = false): this {
    // Sampled: SVG arcs by flags would need the sweep worked out, points need nothing.
    const steps = 16;
    let span = a1 - a0;
    if (anticlockwise && span > 0) span -= Math.PI * 2;
    for (let i = 0; i <= steps; i++) {
      const a = a0 + (span * i) / steps;
      const px = x + Math.cos(a) * r;
      const py = y + Math.sin(a) * r;
      this.path += `${this.path === '' ? 'M' : 'L'}${n(px)} ${n(py)} `;
    }
    return this;
  }

  strokePath(): this {
    if (this.path) this.parts.push(`<path d="${this.path.trim()}" ${this.s}/>`);
    this.path = '';
    return this;
  }
}

/**
 * A battle figure of class `cls` in a house's tinctures, as an SVG group, feet at (x, y) in the
 * battle's own scale (about 90 px tall); `active` draws the nimbus of the unit that plays.
 */
export function figureSvg(
  cls: ClassId,
  x: number,
  y: number,
  primary: number,
  secondary: number,
  facing: -1 | 1 = 1,
  active = false,
): string {
  const pen = new SvgPen();
  const g = pen as unknown as Phaser.GameObjects.Graphics;
  const drawn = drawnFigure(cls, primary, secondary);
  if (drawn) {
    // The nimbus round the head, as in the battle, behind the figure.
    if (active) drawNimbus(g, x + facing * 3, y - 66, 0);
    return `<g>${pen.parts.join('')}<g transform="translate(${n(x)} ${n(y)}) scale(${facing} 1)">${drawn}</g></g>`;
  }
  drawFigure(g, x, y, facing, primary, secondary, cls, active, 0);
  drawClassMark(g, cls, x, y, facing);
  return `<g>${pen.parts.join('')}</g>`;
}

/** A multiply tint in a colour, as Phaser tints the house's pieces. */
const tintFilter = (c: string): string =>
  `<filter id="tint-${c.slice(1)}" color-interpolation-filters="sRGB"><feFlood flood-color="${c}"/>` +
  `<feComposite in2="SourceAlpha" operator="in"/><feBlend in="SourceGraphic" mode="multiply"/></filter>`;

/**
 * The drawn figure of class `cls` at rest, feet at (0, 0), facing right, its house's pieces in
 * its tinctures and no weapon in hand; null when the class has no drawing.
 */
function drawnFigure(cls: ClassId, primary: number, secondary: number): string | null {
  const svg = ART[`../../assets/units/${cls}/${cls}.svg`];
  const rig = RIGS.get(cls)?.rig;
  if (!svg || !rig) return null;
  let inner = svg.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');
  const p = hex(primary);
  const s = hex(secondary);
  for (const pc of rig.pieces) {
    const open = `<g id="piece-${pc.id}">`;
    if (pc.slot) {
      const at = inner.indexOf(open);
      const end = at < 0 ? -1 : inner.indexOf('</g>', at);
      if (end >= 0) inner = inner.slice(0, at) + inner.slice(end + 4);
    } else if (pc.tint) {
      const c = pc.tint === 'primary' ? p : s;
      inner = inner.replace(open, `<g filter="url(#tint-${c.slice(1)})">`);
    } else {
      inner = inner.replace(open, '<g>');
    }
  }
  return `<defs>${tintFilter(p)}${tintFilter(s)}</defs>${inner}`;
}
