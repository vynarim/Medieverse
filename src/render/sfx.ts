// Sound effects (GDD §11, ASSETS §6), synthesised on the spot with the Web Audio API like the
// music: no audio file. Each effect is a short recipe of layers (a sharp transient, a body of
// shaped noise, tones or resonances, scattered debris), on the effects bus of render/audio.ts,
// panned by where it happens on screen and sent to a small outdoor reverb. Every play varies a
// little in pitch and loudness, as no two real sounds are alike. The battle scene calls play()
// for the sim's events; a burst of events (a match caught up after a reload) is held to a few.
import { audio } from './audio.ts';

export type SfxId =
  | 'bow'
  | 'crossbow'
  | 'sling'
  | 'throw'
  | 'thud'
  | 'explosionS'
  | 'explosionM'
  | 'explosionL'
  | 'fire'
  | 'pig'
  | 'swarm'
  | 'falcon'
  | 'creak'
  | 'volley'
  | 'sword'
  | 'mace'
  | 'charge'
  | 'hurt'
  | 'death'
  | 'splash'
  | 'thunder'
  | 'stone'
  | 'collapse'
  | 'roar'
  | 'chomp'
  | 'sparkle'
  | 'chime'
  | 'pickup'
  | 'heal'
  | 'bell'
  | 'horn'
  | 'fanfare'
  | 'click'
  | 'wood'
  | 'flap'
  | 'clink'
  | 'choir'
  | 'dig'
  | 'squeak'
  | 'refused'
  | 'step'
  | 'jump'
  | 'land';

/** ms the same effect waits before it may sound again, so a volley is not a din */
const SAME_SFX_MS = 45;
/** length of the rain's loop, s, and how many drops fall in a second */
const RAIN_LOOP_S = 6;
const RAIN_DROPS_PER_S = 100;
/** effects at most within one frame */
const MAX_PER_FRAME = 6;
/** s of the reverb's tail: an open field with a few walls and trees around */
const REVERB_S = 1.6;
/** semitones a play may stray from the recipe, either way, and its loudness, ± fraction */
const PITCH_SPREAD = 1.2;
const GAIN_SPREAD = 0.15;
/** share of an effect sent to the reverb, when the recipe does not say */
const DEFAULT_SEND = 0.12;

/** How much of each effect reaches the reverb: the big and far sounds ring out, the UI stays dry. */
const SEND: Partial<Record<SfxId, number>> = {
  explosionS: 0.25,
  explosionM: 0.32,
  explosionL: 0.4,
  thunder: 0.45,
  collapse: 0.35,
  roar: 0.3,
  sword: 0.22,
  mace: 0.2,
  stone: 0.2,
  wood: 0.18,
  bell: 0.35,
  horn: 0.35,
  choir: 0.4,
  fanfare: 0.25,
  click: 0,
  refused: 0,
  squeak: 0,
  step: 0.05,
};

/** Effects that are notes of music, or signals: they keep their pitch. */
const TUNED: ReadonlySet<SfxId> = new Set<SfxId>([
  'sparkle',
  'chime',
  'pickup',
  'heal',
  'bell',
  'horn',
  'fanfare',
  'click',
  'choir',
  'refused',
]);

type NoiseColour = 'white' | 'pink' | 'brown';

class Sfx {
  private bufs: Record<NoiseColour, AudioBuffer> | null = null;
  private rainBuf: AudioBuffer | null = null;
  private reverbIn: AudioNode | null = null;
  private readonly last = new Map<SfxId, number>();
  private frame = -1;
  private inFrame = 0;
  /** the rain's hiss while it rains, if any */
  private rain: { src: AudioBufferSourceNode; gain: GainNode } | null = null;

  /** Plays effect `id`, panned from -1 (left of the screen) to 1 (right). */
  play(id: SfxId, pan = 0): void {
    const ctx = audio.ctx;
    const bus = audio.sfx;
    if (!ctx || !bus || !audio.sfxOn) return;
    const now = performance.now();
    const frame = Math.floor(now / 16);
    if (frame !== this.frame) {
      this.frame = frame;
      this.inFrame = 0;
    }
    if (this.inFrame >= MAX_PER_FRAME) return;
    if (now - (this.last.get(id) ?? -1e9) < SAME_SFX_MS) return;
    this.last.set(id, now);
    this.inFrame++;
    const out = ctx.createStereoPanner();
    out.pan.value = Math.max(-1, Math.min(1, pan)) * 0.7;
    out.connect(bus);
    const send = SEND[id] ?? DEFAULT_SEND;
    if (send > 0) {
      const g = ctx.createGain();
      g.gain.value = send;
      out.connect(g);
      g.connect(this.reverb(ctx, bus));
    }
    const pitch = TUNED.has(id) ? 1 : 2 ** (((Math.random() * 2 - 1) * PITCH_SPREAD) / 12);
    const gain = 1 + (Math.random() * 2 - 1) * GAIN_SPREAD;
    RECIPES[id](new Kit(ctx, out, this.noise(ctx), pitch, gain), ctx.currentTime + 0.01);
    // The node graph frees itself once its sources have stopped.
  }

  /** True while the rain falls (the test settings switch it on and off). */
  get raining(): boolean {
    return this.rain !== null;
  }

  /** The rain's hiss, while it rains. */
  setRain(on: boolean): void {
    const ctx = audio.ctx;
    const bus = audio.sfx;
    if (!on || !ctx || !bus || !audio.sfxOn) {
      if (this.rain && ctx) {
        const { src, gain } = this.rain;
        gain.gain.setTargetAtTime(0, ctx.currentTime, 0.6);
        src.stop(ctx.currentTime + 3);
      }
      this.rain = null;
      return;
    }
    if (this.rain) return;
    const src = ctx.createBufferSource();
    src.buffer = this.rainBuffer(ctx);
    src.loop = true;
    // No rumble under the shower, and no hiss over it.
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 1100;
    f.Q.value = 0.35;
    const gain = ctx.createGain();
    gain.gain.value = 0;
    gain.gain.setTargetAtTime(0.09, ctx.currentTime, 1.5);
    src.connect(f);
    f.connect(gain);
    gain.connect(bus);
    src.start();
    this.rain = { src, gain };
  }

  /**
   * A shower on the fields: a soft wash of dark noise that swells and ebbs, and over it the
   * patter of drops, each a muffled tap of noise (never a tone: tones chirp like crickets),
   * some near and bright, most far and dull; in stereo, so it falls all around.
   */
  private rainBuffer(ctx: AudioContext): AudioBuffer {
    if (this.rainBuf) return this.rainBuf;
    const rate = ctx.sampleRate;
    const buf = ctx.createBuffer(2, rate * RAIN_LOOP_S, rate);
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c);
      // The wash: white noise through two gentle low-pass poles, swelling slowly (whole cycles
      // over the loop, so that it joins seamlessly).
      let a = 0;
      let b = 0;
      const phase = Math.random() * 2 * Math.PI;
      for (let i = 0; i < d.length; i++) {
        a += (Math.random() * 2 - 1 - a) * 0.35;
        b += (a - b) * 0.35;
        const swell = 0.75 + 0.25 * Math.sin(phase + (2 * Math.PI * 2 * i) / d.length);
        d[i] = b * 0.55 * swell;
      }
      const drops = RAIN_DROPS_PER_S * RAIN_LOOP_S;
      for (let k = 0; k < drops; k++) {
        const at = Math.floor(Math.random() * d.length);
        const near = Math.random() < 0.15;
        const amp = (near ? 0.5 : 0.18) * (0.4 + Math.random() * 0.6);
        const tau = rate * (near ? 0.004 : 0.008) * (0.6 + Math.random() * 0.8);
        const len = Math.min(Math.floor(tau * 5), d.length - at);
        // Brightness: how much of the tap's noise passes (a near drop is crisper).
        const k1 = near ? 0.55 : 0.18;
        let y = 0;
        for (let i = 0; i < len; i++) {
          y += (Math.random() * 2 - 1 - y) * k1;
          d[at + i] = (d[at + i] ?? 0) + amp * Math.exp(-i / tau) * y;
        }
      }
    }
    this.rainBuf = buf;
    return buf;
  }

  /**
   * Two seconds of each noise: white (hiss, sparks), pink (wind, fire, water) and brown (earth,
   * rumble, the body of a blast), the last two by Paul Kellet's filters and a leaky integrator.
   */
  private noise(ctx: AudioContext): Record<NoiseColour, AudioBuffer> {
    if (this.bufs) return this.bufs;
    const n = ctx.sampleRate * 2;
    const white = ctx.createBuffer(1, n, ctx.sampleRate);
    const pink = ctx.createBuffer(1, n, ctx.sampleRate);
    const brown = ctx.createBuffer(1, n, ctx.sampleRate);
    const w = white.getChannelData(0);
    const p = pink.getChannelData(0);
    const b = brown.getChannelData(0);
    let b0 = 0;
    let b1 = 0;
    let b2 = 0;
    let last = 0;
    for (let i = 0; i < n; i++) {
      const x = Math.random() * 2 - 1;
      w[i] = x;
      b0 = 0.99765 * b0 + x * 0.099046;
      b1 = 0.963 * b1 + x * 0.2965164;
      b2 = 0.57 * b2 + x * 1.0526913;
      p[i] = (b0 + b1 + b2 + x * 0.1848) * 0.2;
      last = (last + 0.02 * x) / 1.02;
      b[i] = last * 3.5;
    }
    this.bufs = { white, pink, brown };
    return this.bufs;
  }

  /**
   * The reverb, made once: a stereo impulse of decaying noise that darkens as it dies (the air
   * and the grass drink the highs), after a few early echoes off walls and trees.
   */
  private reverb(ctx: AudioContext, bus: AudioNode): AudioNode {
    if (this.reverbIn) return this.reverbIn;
    const rate = ctx.sampleRate;
    const ir = ctx.createBuffer(2, Math.floor(rate * REVERB_S), rate);
    for (let c = 0; c < 2; c++) {
      const d = ir.getChannelData(c);
      let y = 0;
      for (let i = 0; i < d.length; i++) {
        const s = i / rate;
        // The low-pass closes from bright to dull over the tail.
        const k = 0.6 * Math.exp(-s * 2.2) + 0.04;
        y += (Math.random() * 2 - 1 - y) * k;
        d[i] = y * Math.exp(-s / 0.32) * Math.min(1, s / 0.012);
      }
      for (const [ms, amp] of [
        [11, 0.5],
        [23, 0.35],
        [37, 0.3],
        [58, 0.2],
      ] as const) {
        const at = Math.floor(((ms + c * 3) / 1000) * rate);
        d[at] = (d[at] ?? 0) + amp * (c === 0 ? 1 : -1);
      }
    }
    const conv = ctx.createConvolver();
    conv.buffer = ir;
    conv.connect(bus);
    this.reverbIn = conv;
    return conv;
  }
}

interface Shape {
  peak?: number;
  attack?: number;
  /** s at the peak before the decay */
  hold?: number;
  decay?: number;
}

/** The few gestures every recipe is made of. */
class Kit {
  readonly ctx: AudioContext;
  private readonly out: AudioNode;
  private readonly bufs: Record<NoiseColour, AudioBuffer>;
  /** this play's pitch factor and loudness factor */
  private readonly pitch: number;
  private readonly gain: number;

  constructor(
    ctx: AudioContext,
    out: AudioNode,
    bufs: Record<NoiseColour, AudioBuffer>,
    pitch: number,
    gain: number,
  ) {
    this.ctx = ctx;
    this.out = out;
    this.bufs = bufs;
    this.pitch = pitch;
    this.gain = gain;
  }

  /** A random number in [a, b): for scattered debris and crackles. */
  rand(a: number, b: number): number {
    return a + Math.random() * (b - a);
  }

  /**
   * A gain that rises in `attack` s to `peak`, holds `hold` s, then dies away exponentially
   * over `decay` s; returns it and the time it ends.
   */
  private env(t: number, o: Shape, attack0: number, decay0: number): [GainNode, number] {
    const attack = o.attack ?? attack0;
    const hold = o.hold ?? 0;
    const decay = o.decay ?? decay0;
    const peak = (o.peak ?? 0.3) * this.gain;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + attack);
    if (hold > 0) g.gain.setValueAtTime(peak, t + attack + hold);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + hold + decay);
    g.connect(this.out);
    return [g, t + attack + hold + decay];
  }

  /** A tone gliding from `f0` to `f1` Hz, with an optional vibrato (rate Hz, depth in Hz). */
  tone(
    t: number,
    f0: number,
    f1: number,
    o: Shape & { type?: OscillatorType; vibrato?: readonly [number, number] } = {},
  ): void {
    const [g, end] = this.env(t, o, 0.005, 0.2);
    const osc = this.ctx.createOscillator();
    osc.type = o.type ?? 'sine';
    osc.frequency.setValueAtTime(f0 * this.pitch, t);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, f1 * this.pitch), end);
    if (o.vibrato) this.wobble(osc.frequency, t, end, o.vibrato);
    osc.connect(g);
    osc.start(t);
    osc.stop(end + 0.05);
  }

  /**
   * A voice or a resonant body: a buzz gliding from `f0` to `f1` Hz through formant band-passes
   * ([Hz, gain]), as a throat or a creaking beam colours it. Grunts, squeals, roars, creaks.
   */
  voice(
    t: number,
    f0: number,
    f1: number,
    formants: readonly (readonly [number, number])[],
    o: Shape & { q?: number; vibrato?: readonly [number, number] } = {},
  ): void {
    const [g, end] = this.env(t, o, 0.02, 0.2);
    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(f0 * this.pitch, t);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, f1 * this.pitch), end);
    if (o.vibrato) this.wobble(osc.frequency, t, end, o.vibrato);
    for (const [f, gain] of formants) {
      const bp = this.ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = f * Math.sqrt(this.pitch);
      bp.Q.value = o.q ?? 5;
      const fg = this.ctx.createGain();
      fg.gain.value = gain;
      osc.connect(bp);
      bp.connect(fg);
      fg.connect(g);
    }
    osc.start(t);
    osc.stop(end + 0.05);
  }

  /** A struck body ringing: sine partials at `ratios` of `f` Hz, the high ones dying sooner. */
  ring(t: number, f: number, ratios: readonly number[], o: Shape = {}): void {
    const peak = o.peak ?? 0.1;
    const decay = o.decay ?? 0.5;
    ratios.forEach((r, i) =>
      this.tone(t, f * r, f * r * 0.998, {
        peak: peak / (1 + i * 0.6),
        attack: 0.001,
        decay: decay / (1 + i * 0.7),
      }),
    );
  }

  /** Noise through a filter whose frequency glides from `f0` to `f1` Hz. */
  noise(
    t: number,
    f0: number,
    f1: number,
    o: Shape & { type?: BiquadFilterType; q?: number; colour?: NoiseColour } = {},
  ): void {
    const [g, end] = this.env(t, o, 0.003, 0.15);
    const f = this.ctx.createBiquadFilter();
    f.type = o.type ?? 'bandpass';
    f.Q.value = o.q ?? 1;
    f.frequency.setValueAtTime(f0 * this.pitch, t);
    f.frequency.exponentialRampToValueAtTime(Math.max(20, f1 * this.pitch), end);
    f.connect(g);
    const src = this.ctx.createBufferSource();
    src.buffer = this.bufs[o.colour ?? 'white'];
    // Each sound starts somewhere else in the noise: no two alike.
    src.connect(f);
    src.start(t, Math.random() * 1.5);
    src.stop(end + 0.05);
  }

  /** The first instant of a hit: a click of a few ms, high-passed, that gives it its edge. */
  crack(t: number, peak: number, f = 2500): void {
    this.noise(t, f, f, { type: 'highpass', q: 0.7, peak, attack: 0.0005, decay: 0.012 });
  }

  /**
   * `n` small taps scattered over `span` s: pebbles, splinters, crackling embers, droplets. Each
   * has its own band between `f0` and `f1` Hz and a random loudness up to `peak`, fading with time.
   */
  scatter(
    t: number,
    n: number,
    span: number,
    f0: number,
    f1: number,
    o: { peak?: number; decay?: number; q?: number; colour?: NoiseColour } = {},
  ): void {
    for (let i = 0; i < n; i++) {
      const dt = span * Math.random() ** 1.6;
      const f = this.rand(f0, f1);
      this.noise(t + dt, f, f * 0.8, {
        q: o.q ?? 2,
        peak: (o.peak ?? 0.1) * this.rand(0.3, 1) * (1 - (0.6 * dt) / Math.max(span, 0.001)),
        attack: 0.001,
        decay: (o.decay ?? 0.02) * this.rand(0.6, 1.4),
        colour: o.colour ?? 'white',
      });
    }
  }

  /** A low-frequency wobble on `param` from `t` to `end`: [rate Hz, depth in the param's unit]. */
  private wobble(
    param: AudioParam,
    t: number,
    end: number,
    [rate, depth]: readonly [number, number],
  ): void {
    const lfo = this.ctx.createOscillator();
    lfo.frequency.value = rate;
    const d = this.ctx.createGain();
    d.gain.value = depth * this.pitch;
    lfo.connect(d);
    d.connect(param);
    lfo.start(t);
    lfo.stop(end + 0.05);
  }
}

type Recipe = (k: Kit, t: number) => void;

/**
 * A blast: the crack of the powder, a thump in the chest whose pitch falls fast, the roar of the
 * air pushed out, the long rumble that follows, and earth and stones raining back.
 */
const boom =
  (peak: number, length: number): Recipe =>
  (k, t) => {
    k.crack(t, peak * 1.4, 1200);
    k.tone(t, 140, 34, { peak: peak * 1.6, attack: 0.002, decay: length * 0.45 });
    k.noise(t, 2600, 140, {
      type: 'lowpass',
      q: 0.8,
      peak: peak * 1.3,
      attack: 0.004,
      decay: length * 0.7,
      colour: 'brown',
    });
    k.noise(t + 0.01, 1800, 500, {
      q: 0.6,
      peak: peak * 0.5,
      decay: length * 0.35,
      colour: 'pink',
    });
    k.noise(t + 0.06, 220, 50, {
      type: 'lowpass',
      peak: peak * 0.8,
      attack: 0.08,
      decay: length * 1.5,
      colour: 'brown',
    });
    k.scatter(t + 0.08, Math.round(6 + length * 10), length * 0.9, 900, 3800, {
      peak: peak * 0.35,
      decay: 0.025,
    });
    k.scatter(t + 0.25, Math.round(3 + length * 4), length, 250, 700, {
      peak: peak * 0.5,
      decay: 0.05,
      colour: 'brown',
    });
  };

/** A short swish through the air, from low to high and back: a blade, a club, a sling. */
const swish = (k: Kit, t: number, lo: number, hi: number, peak: number, len: number): void => {
  k.noise(t, lo, hi, { q: 1.8, peak, attack: len * 0.6, decay: len * 0.4, colour: 'pink' });
  k.noise(t + len * 0.55, hi, lo, {
    q: 1.4,
    peak: peak * 0.6,
    attack: 0.005,
    decay: len * 0.5,
    colour: 'pink',
  });
};

/** A body taking a blow: a dull slap of cloth and flesh, and the mail rattling on it. */
const bodyHit = (k: Kit, t: number, peak: number): void => {
  k.noise(t, 900, 180, { type: 'lowpass', peak, attack: 0.001, decay: 0.06, colour: 'brown' });
  k.scatter(t + 0.01, 5, 0.1, 5000, 8500, { peak: peak * 0.18, decay: 0.012, q: 4 });
};

/** A stone knocking on stone: a crack, a short knock tuned by its size, grit. */
const knock = (k: Kit, t: number, f: number, peak: number): void => {
  k.crack(t, peak * 0.6, 2000);
  k.noise(t, f, f * 0.7, { q: 3, peak, attack: 0.001, decay: 0.07 });
  k.noise(t, 500, 150, {
    type: 'lowpass',
    peak: peak * 0.6,
    attack: 0.001,
    decay: 0.09,
    colour: 'brown',
  });
  k.scatter(t + 0.02, 3, 0.12, 1800, 4000, { peak: peak * 0.2, decay: 0.015 });
};

const RECIPES: Readonly<Record<SfxId, Recipe>> = {
  // The string let go: the snap at the nock, the stave's low thrum, and the arrow's whistle away.
  bow: (k, t) => {
    k.crack(t, 0.18, 3000);
    k.tone(t, 118, 96, { type: 'triangle', peak: 0.22, attack: 0.001, decay: 0.14 });
    k.tone(t, 236, 190, { peak: 0.06, attack: 0.001, decay: 0.08 });
    k.noise(t + 0.02, 900, 2600, { q: 1.6, peak: 0.1, attack: 0.05, decay: 0.22, colour: 'pink' });
  },
  // The latch's metal click, the heavy prod's thunk, a short hiss.
  crossbow: (k, t) => {
    k.noise(t, 4200, 3800, { q: 6, peak: 0.12, attack: 0.0005, decay: 0.008 });
    k.crack(t + 0.012, 0.25, 2200);
    k.tone(t + 0.012, 95, 55, { peak: 0.32, attack: 0.001, decay: 0.09 });
    k.noise(t + 0.012, 1400, 300, {
      type: 'lowpass',
      peak: 0.18,
      attack: 0.001,
      decay: 0.07,
      colour: 'brown',
    });
    k.noise(t + 0.03, 1500, 3000, {
      q: 1.5,
      peak: 0.08,
      attack: 0.02,
      decay: 0.12,
      colour: 'pink',
    });
  },
  // The sling whirls round twice, faster, and lets go.
  sling: (k, t) => {
    swish(k, t, 300, 900, 0.1, 0.16);
    swish(k, t + 0.17, 380, 1200, 0.13, 0.12);
    swish(k, t + 0.3, 450, 1600, 0.18, 0.1);
  },
  throw: (k, t) => {
    k.voice(
      t,
      180,
      150,
      [
        [600, 1],
        [1000, 0.5],
      ],
      { peak: 0.04, attack: 0.01, decay: 0.1 },
    );
    swish(k, t + 0.02, 250, 900, 0.14, 0.2);
  },
  // An arrow or a stone into the ground: a dull thump, and a little earth thrown up.
  thud: (k, t) => {
    k.crack(t, 0.08, 1500);
    k.noise(t, 600, 120, {
      type: 'lowpass',
      peak: 0.26,
      attack: 0.001,
      decay: 0.1,
      colour: 'brown',
    });
    k.tone(t, 95, 45, { peak: 0.14, attack: 0.001, decay: 0.07 });
    k.scatter(t + 0.02, 4, 0.12, 700, 2200, { peak: 0.06, decay: 0.02, colour: 'pink' });
  },
  explosionS: boom(0.18, 0.5),
  explosionM: boom(0.24, 0.85),
  explosionL: boom(0.3, 1.35),
  // Greek fire catching: the whoomph of the flame, then its roar and crackling.
  fire: (k, t) => {
    k.noise(t, 200, 1600, {
      type: 'lowpass',
      peak: 0.3,
      attack: 0.08,
      decay: 0.25,
      colour: 'brown',
    });
    k.noise(t + 0.05, 600, 900, {
      q: 0.5,
      peak: 0.12,
      attack: 0.15,
      hold: 0.2,
      decay: 0.5,
      colour: 'pink',
    });
    k.scatter(t + 0.08, 14, 0.9, 1800, 5000, { peak: 0.09, decay: 0.006, q: 1.2 });
  },
  // The flaming pig: two squealing grunts, the second higher, burlesque.
  pig: (k, t) => {
    for (const [dt, f] of [
      [0, 220],
      [0.24, 300],
    ] as const) {
      k.voice(
        t + dt,
        f,
        f * 0.75,
        [
          [700, 1],
          [1400, 0.6],
          [2600, 0.3],
        ],
        {
          peak: 0.2,
          attack: 0.02,
          decay: 0.18,
          vibrato: [28, f * 0.06],
        },
      );
      k.noise(t + dt, 500, 300, { q: 3, peak: 0.05, attack: 0.01, decay: 0.12, colour: 'pink' });
    }
  },
  // Bees: wings buzzing, each its own pitch and its own tremble.
  swarm: (k, t) => {
    for (const f of [205, 219, 232, 247]) {
      k.voice(
        t + k.rand(0, 0.1),
        f,
        f * 1.04,
        [
          [450, 1],
          [900, 0.5],
        ],
        {
          peak: 0.05,
          attack: 0.15,
          decay: 0.9,
          q: 2,
          vibrato: [k.rand(5, 9), f * 0.03],
        },
      );
    }
  },
  // A hawk's cry, kee-eeer: a high wavering whistle with a rasp, twice.
  falcon: (k, t) => {
    for (const [dt, p] of [
      [0, 0.12],
      [0.38, 0.09],
    ] as const) {
      k.tone(t + dt, 2300, 1500, { peak: p, attack: 0.015, decay: 0.32, vibrato: [32, 90] });
      k.noise(t + dt, 2600, 1800, { q: 6, peak: p * 0.3, attack: 0.015, decay: 0.25 });
    }
  },
  // A siege engine: its timbers creak under the load (a slow stick-slip buzz), then the arm swings.
  creak: (k, t) => {
    k.voice(
      t,
      28,
      44,
      [
        [650, 1],
        [1300, 0.4],
      ],
      { peak: 0.14, attack: 0.05, decay: 0.3, q: 9 },
    );
    k.noise(t + 0.25, 180, 700, { q: 1.2, peak: 0.2, attack: 0.08, decay: 0.3, colour: 'pink' });
    k.crack(t + 0.55, 0.12, 1200);
    k.noise(t + 0.55, 400, 120, {
      type: 'lowpass',
      peak: 0.2,
      attack: 0.001,
      decay: 0.12,
      colour: 'brown',
    });
  },
  // A rain of arrows: many strings, not in step, and the hiss of the flight.
  volley: (k, t) => {
    for (let i = 0; i < 7; i++) {
      const dt = k.rand(0, 0.35);
      k.crack(t + dt, 0.05, 3000);
      k.tone(t + dt, k.rand(100, 130), 90, {
        type: 'triangle',
        peak: 0.06,
        attack: 0.001,
        decay: 0.1,
      });
    }
    k.noise(t + 0.05, 800, 2400, { q: 1.2, peak: 0.12, attack: 0.15, decay: 0.4, colour: 'pink' });
  },
  // A swing, and steel on steel: a bright clang whose partials are not in tune (a bar, not a string).
  sword: (k, t) => {
    swish(k, t, 500, 2000, 0.1, 0.12);
    k.crack(t + 0.12, 0.2, 3500);
    k.ring(t + 0.12, k.rand(1150, 1350), [1, 2.76, 5.4, 8.93], { peak: 0.1, decay: 0.55 });
    k.noise(t + 0.12, 7000, 4000, { q: 2, peak: 0.08, attack: 0.001, decay: 0.08 });
  },
  // A heavy swing, and iron on mail: a deep thud, the dull ring of the head, the mail jingling.
  mace: (k, t) => {
    swish(k, t, 250, 800, 0.12, 0.14);
    k.crack(t + 0.14, 0.2, 1500);
    k.tone(t + 0.14, 150, 45, { peak: 0.36, attack: 0.001, decay: 0.18 });
    k.ring(t + 0.14, 420, [1, 2.76], { peak: 0.05, decay: 0.15 });
    bodyHit(k, t + 0.14, 0.25);
  },
  // Running feet in mail, then the shield banging into its man.
  charge: (k, t) => {
    for (let i = 0; i < 4; i++) {
      const dt = i * 0.11 + k.rand(-0.01, 0.01);
      k.noise(t + dt, 500, 150, {
        type: 'lowpass',
        peak: 0.16,
        attack: 0.002,
        decay: 0.05,
        colour: 'brown',
      });
      k.scatter(t + dt, 2, 0.05, 5000, 8000, { peak: 0.03, decay: 0.01, q: 4 });
    }
    k.crack(t + 0.45, 0.2, 1500);
    k.tone(t + 0.45, 190, 120, { type: 'triangle', peak: 0.2, attack: 0.001, decay: 0.08 });
    k.noise(t + 0.45, 650, 500, { q: 4, peak: 0.15, attack: 0.001, decay: 0.08 });
    bodyHit(k, t + 0.46, 0.25);
  },
  // A unit hurt: a blow on the body and a comic « oof » (a voiced grunt, not a beep).
  hurt: (k, t) => {
    bodyHit(k, t, 0.22);
    k.voice(
      t + 0.02,
      k.rand(150, 210),
      110,
      [
        [450, 1],
        [800, 0.5],
        [2500, 0.15],
      ],
      {
        peak: 0.22,
        attack: 0.015,
        decay: 0.16,
      },
    );
  },
  // A unit falls for good: the slide whistle of the farce, breathy, then it hits the ground.
  death: (k, t) => {
    k.tone(t, 1100, 220, { peak: 0.12, attack: 0.02, decay: 0.7, vibrato: [6, 18] });
    k.noise(t, 1100, 250, { q: 3, peak: 0.03, attack: 0.02, decay: 0.7, colour: 'pink' });
    k.noise(t + 0.75, 500, 120, {
      type: 'lowpass',
      peak: 0.25,
      attack: 0.002,
      decay: 0.12,
      colour: 'brown',
    });
    k.scatter(t + 0.76, 4, 0.12, 5000, 8000, { peak: 0.04, decay: 0.012, q: 4 });
  },
  // Into the water: the slap, the gush of foam, bubbles, and drops falling back.
  splash: (k, t) => {
    k.crack(t, 0.15, 1200);
    k.noise(t, 3500, 500, {
      type: 'lowpass',
      peak: 0.3,
      attack: 0.008,
      decay: 0.45,
      colour: 'pink',
    });
    k.noise(t, 400, 120, {
      type: 'lowpass',
      peak: 0.2,
      attack: 0.002,
      decay: 0.15,
      colour: 'brown',
    });
    for (let i = 0; i < 6; i++) {
      const f = k.rand(350, 900);
      k.tone(t + k.rand(0.05, 0.4), f, f * 1.8, { peak: 0.03, attack: 0.002, decay: 0.04 });
    }
    k.scatter(t + 0.25, 8, 0.5, 1500, 4000, { peak: 0.06, decay: 0.012 });
  },
  // Lightning: the tearing crack overhead, then the long roll of thunder echoing back.
  thunder: (k, t) => {
    k.crack(t, 0.4, 2000);
    k.scatter(t, 12, 0.18, 1500, 6000, { peak: 0.25, decay: 0.01 });
    k.noise(t + 0.05, 500, 60, {
      type: 'lowpass',
      peak: 0.55,
      attack: 0.1,
      decay: 2.6,
      colour: 'brown',
    });
    k.noise(t + 0.7, 300, 50, {
      type: 'lowpass',
      peak: 0.35,
      attack: 0.2,
      decay: 1.8,
      colour: 'brown',
    });
    k.noise(t + 1.4, 250, 50, {
      type: 'lowpass',
      peak: 0.2,
      attack: 0.3,
      decay: 1.4,
      colour: 'brown',
    });
  },
  stone: (k, t) => knock(k, t, k.rand(450, 650), 0.25),
  // Masonry giving way: a deep rumble, blocks knocking as they fall, dust and grit.
  collapse: (k, t) => {
    k.noise(t, 600, 70, { type: 'lowpass', peak: 0.5, attack: 0.05, decay: 1.7, colour: 'brown' });
    for (let i = 0; i < 7; i++) knock(k, t + 0.08 + k.rand(0, 1.1), k.rand(250, 650), 0.2);
    k.scatter(t + 0.2, 20, 1.4, 1500, 5000, { peak: 0.06, decay: 0.015 });
    k.noise(t + 0.3, 1200, 500, { q: 0.5, peak: 0.06, attack: 0.3, decay: 1, colour: 'pink' });
  },
  // The dragon: a throaty growl rising and falling, with breath.
  roar: (k, t) => {
    k.voice(
      t,
      85,
      62,
      [
        [320, 1],
        [750, 0.6],
        [1600, 0.25],
      ],
      {
        peak: 0.32,
        attack: 0.15,
        hold: 0.3,
        decay: 0.8,
        q: 3,
        vibrato: [11, 6],
      },
    );
    k.noise(t, 900, 300, {
      q: 0.8,
      peak: 0.14,
      attack: 0.15,
      hold: 0.3,
      decay: 0.8,
      colour: 'pink',
    });
  },
  // Jaws: teeth clacking twice, wet.
  chomp: (k, t) => {
    for (const dt of [0, 0.14]) {
      k.crack(t + dt, 0.18, 2500);
      k.noise(t + dt, 1200, 500, { q: 2, peak: 0.25, attack: 0.001, decay: 0.06 });
      k.noise(t + dt + 0.01, 600, 300, {
        q: 3,
        peak: 0.08,
        attack: 0.005,
        decay: 0.08,
        colour: 'pink',
      });
    }
  },
  // The unicorn: a glitter of high notes.
  sparkle: (k, t) => {
    [1568, 1976, 2349, 3136].forEach((f, i) =>
      k.tone(t + i * 0.06, f, f, { type: 'triangle', peak: 0.06, decay: 0.3 }),
    );
  },
  chime: (k, t) => {
    k.tone(t, 1320, 1320, { peak: 0.08, decay: 0.9 });
    k.tone(t, 3460, 3460, { peak: 0.03, decay: 0.5 });
  },
  pickup: (k, t) => {
    k.tone(t, 880, 880, { type: 'triangle', peak: 0.1, decay: 0.1 });
    k.tone(t + 0.09, 1320, 1320, { type: 'triangle', peak: 0.1, decay: 0.18 });
  },
  heal: (k, t) => {
    [784, 988, 1175].forEach((f, i) =>
      k.tone(t + i * 0.08, f, f, { type: 'triangle', peak: 0.08, decay: 0.35 }),
    );
  },
  // The start of a turn: a small chapel bell, its partials a bell's, not a chord's.
  bell: (k, t) => {
    k.crack(t, 0.03, 4000);
    k.ring(t, 660, [0.5, 1, 1.19, 1.5, 2, 2.5], { peak: 0.07, decay: 1.6 });
  },
  // The Déluge: a horn, then its fifth.
  horn: (k, t) => {
    k.voice(
      t,
      220,
      220,
      [
        [500, 1],
        [1100, 0.6],
      ],
      { peak: 0.2, attack: 0.25, hold: 0.4, decay: 0.6, q: 3, vibrato: [5, 2] },
    );
    k.voice(
      t + 0.9,
      330,
      330,
      [
        [500, 1],
        [1100, 0.6],
      ],
      { peak: 0.2, attack: 0.2, hold: 0.5, decay: 0.8, q: 3, vibrato: [5, 3] },
    );
  },
  fanfare: (k, t) => {
    [523, 659, 784, 1047].forEach((f, i) =>
      k.tone(t + i * 0.16, f, f, {
        type: 'square',
        peak: 0.06,
        attack: 0.01,
        decay: i === 3 ? 0.9 : 0.15,
      }),
    );
  },
  click: (k, t) => {
    k.noise(t, 3000, 2000, { q: 3, peak: 0.12, decay: 0.03 });
  },
  // Wood knocked: two hollow knocks with a timber's uneven partials.
  wood: (k, t) => {
    for (const [dt, f] of [
      [0, 420],
      [0.09, 380],
    ] as const) {
      k.crack(t + dt, 0.08, 2000);
      k.ring(t + dt, f, [1, 2.3, 4.1], { peak: 0.14, decay: 0.09 });
      k.noise(t + dt, f * 1.5, f, { q: 4, peak: 0.08, attack: 0.001, decay: 0.05 });
    }
  },
  // Wings beating: soft whumphs of air, low.
  flap: (k, t) => {
    for (let i = 0; i < 3; i++) {
      k.noise(t + i * 0.1, 250, 900, {
        type: 'lowpass',
        peak: 0.16,
        attack: 0.03,
        decay: 0.07,
        colour: 'pink',
      });
    }
  },
  clink: (k, t) => {
    k.crack(t, 0.05, 5000);
    k.ring(t, 2400, [1, 2.76], { peak: 0.07, decay: 0.2 });
  },
  // The miracle: a short choir, "aah".
  choir: (k, t) => {
    for (const f of [392, 494, 587, 784]) {
      k.voice(
        t,
        f,
        f * 1.003,
        [
          [800, 1],
          [1200, 0.5],
          [2600, 0.2],
        ],
        {
          peak: 0.06,
          attack: 0.25,
          decay: 1,
          q: 4,
          vibrato: [5.5, f * 0.006],
        },
      );
    }
  },
  // A spade into earth: the blade bites with a scrape, the clod falls, pebbles roll.
  dig: (k, t) => {
    for (let i = 0; i < 4; i++) {
      const at = t + i * 0.32 + k.rand(-0.02, 0.02);
      k.noise(at, 1800, 900, { q: 2, peak: 0.08, attack: 0.002, decay: 0.05 });
      k.noise(at + 0.02, 700, 150, {
        type: 'lowpass',
        peak: 0.22,
        attack: 0.002,
        decay: 0.1,
        colour: 'brown',
      });
      k.scatter(at + 0.05, 3, 0.12, 900, 2500, { peak: 0.05, decay: 0.015, colour: 'pink' });
    }
  },
  squeak: (k, t) => {
    k.voice(
      t,
      1400,
      2200,
      [
        [2500, 1],
        [4000, 0.4],
      ],
      { peak: 0.1, attack: 0.005, decay: 0.1, q: 6 },
    );
  },
  refused: (k, t) => {
    k.tone(t, 180, 140, { type: 'square', peak: 0.05, decay: 0.12 });
  },
  // A footstep on turf: a soft thump, a little grit, a jingle of mail.
  step: (k, t) => {
    k.noise(t, 500, 140, {
      type: 'lowpass',
      peak: 0.1,
      attack: 0.002,
      decay: 0.05,
      colour: 'brown',
    });
    k.scatter(t, 2, 0.04, 1500, 3500, { peak: 0.025, decay: 0.012, colour: 'pink' });
    k.scatter(t + 0.01, 2, 0.05, 5500, 8000, { peak: 0.015, decay: 0.01, q: 4 });
  },
  // Off the ground: a short « hup » and a rustle of cloth.
  jump: (k, t) => {
    k.voice(
      t,
      230,
      270,
      [
        [700, 1],
        [1150, 0.5],
      ],
      { peak: 0.08, attack: 0.01, decay: 0.08 },
    );
    k.noise(t, 400, 1200, { q: 1, peak: 0.07, attack: 0.03, decay: 0.1, colour: 'pink' });
  },
  // Back on the ground: a heavy thump, grit, and the mail settling.
  land: (k, t) => {
    k.noise(t, 700, 120, {
      type: 'lowpass',
      peak: 0.22,
      attack: 0.002,
      decay: 0.09,
      colour: 'brown',
    });
    k.tone(t, 85, 45, { peak: 0.1, attack: 0.001, decay: 0.06 });
    k.scatter(t + 0.01, 4, 0.12, 1200, 3500, { peak: 0.04, decay: 0.015, colour: 'pink' });
    k.scatter(t + 0.01, 5, 0.15, 5000, 8500, { peak: 0.03, decay: 0.01, q: 4 });
  },
};

export const sfx = new Sfx();

/** Every effect, in the order of its recipe (the test settings play each one). */
export const SFX_IDS = Object.keys(RECIPES) as SfxId[];
