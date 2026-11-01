// The drawn things that stand on the field (assets/sprites/props.svg): each key, the point of its
// picture that sits on the thing's anchor (its box's (0, 0), as a fraction of the box). A pool of
// images, handed out again every frame, shows them; a key whose picture is not loaded is refused,
// and the scene then draws the thing by code.
import type Phaser from 'phaser';

/** Texture px per world px of the props (props.svg data-scale). */
export const PROP_TEX_SCALE = 3;

/** Box of each prop in props.svg: x, y, w, h, the anchor at (0, 0). */
const BOXES = {
  prop_barrel: [-13, -32, 26, 32],
  prop_kitchen_0: [-28, -50, 56, 50],
  prop_kitchen_1: [-28, -50, 56, 50],
  prop_kitchen_2: [-28, -50, 56, 50],
  prop_pot: [-9, -10, 18, 18],
  prop_mine: [-11, -12, 22, 13],
  prop_grave: [-14, -37, 28, 37],
  prop_engine_ballista: [-36, -48, 72, 48],
  prop_engine_scorpion: [-28, -42, 56, 42],
  prop_engine_catapult: [-42, -66, 84, 66],
  prop_engine_trebuchet: [-50, -122, 100, 122],
  prop_engine_ram: [-52, -54, 122, 54],
} as const satisfies Record<string, readonly [number, number, number, number]>;

export type PropKey = keyof typeof BOXES;

export class PropPool {
  private readonly images: Phaser.GameObjects.Image[] = [];
  private used = 0;

  private readonly scene: Phaser.Scene;
  private readonly depth: number;
  /** called on each image made, to keep it off the HUD's camera */
  private readonly made: (image: Phaser.GameObjects.Image) => void;

  constructor(scene: Phaser.Scene, depth: number, made: (image: Phaser.GameObjects.Image) => void) {
    this.scene = scene;
    this.depth = depth;
    this.made = made;
  }

  /** Before the frame's props. */
  begin(): void {
    this.used = 0;
  }

  /** Shows `key` anchored at (x, y); false when its picture is not loaded. */
  put(key: PropKey, x: number, y: number, tint?: number): boolean {
    if (!this.scene.textures.exists(key)) return false;
    let image = this.images[this.used];
    if (!image) {
      image = this.scene.add
        .image(0, 0, key)
        .setScale(1 / PROP_TEX_SCALE)
        .setDepth(this.depth);
      this.made(image);
      this.images.push(image);
    }
    this.used++;
    const [bx, by, bw, bh] = BOXES[key];
    image
      .setTexture(key)
      .setOrigin(-bx / bw, -by / bh)
      .setPosition(x, y)
      .setVisible(true);
    if (tint === undefined) image.clearTint();
    else image.setTint(tint);
    return true;
  }

  /** After the frame's props: hides the images left over. */
  end(): void {
    for (let i = this.used; i < this.images.length; i++) this.images[i]?.setVisible(false);
  }
}
