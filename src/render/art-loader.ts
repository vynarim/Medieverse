// The drawn art (tools/build-art.ts), loaded from the start, while the title and setup screens
// are up: the battle then opens without waiting for its 180-odd pictures.
import Phaser from 'phaser';
import ART from '../content/art.json';

const KEY = 'art';

class ArtLoader extends Phaser.Scene {
  private readonly done: () => void;

  constructor(done: () => void) {
    super(KEY);
    this.done = done;
  }

  preload(): void {
    for (const [key, path] of Object.entries(ART)) {
      if (!this.textures.exists(key)) this.load.image(key, `${import.meta.env.BASE_URL}${path}`);
    }
  }

  create(): void {
    this.done();
    this.scene.remove(KEY);
  }
}

/** Starts loading the art into the game's textures; resolves once it is all there (or failed). */
export function preloadArt(game: Phaser.Game): Promise<void> {
  return new Promise((resolve) => {
    game.scene.add(KEY, new ArtLoader(resolve), true);
  });
}
