export type CanvasMode = 'blank' | 'photo';

export type GemCategoryId = 'hearts' | 'stars' | 'classic' | 'flowers';

export type GemFilterId = GemCategoryId | 'all';

export interface GemCategory {
  readonly id: GemFilterId;
  readonly label: string;
}

/** A gem design in the catalogue, sliced from the supplied sprite sheet. */
export interface GemAsset {
  readonly id: string;
  readonly label: string;
  readonly category: GemCategoryId;
  /** Path under the app's public assets. */
  readonly src: string;
  /** Natural width / height, used so gems are never stretched off-square. */
  readonly aspect: number;
}

/** One gem placed on the canvas, in logical canvas units (see CANVAS_LOGICAL_SIZE). */
export interface PlacedGem {
  readonly id: string;
  readonly assetId: string;
  /** Center position. */
  readonly x: number;
  readonly y: number;
  /** Length of the gem's longer side. */
  readonly size: number;
  /** Stacking order; higher paints on top. */
  readonly z: number;
  /**
   * `Date.now()` when this gem was first created by placing/duplicating/
   * randomizing. Preserved as-is through moves/resizes and through undo
   * snapshots, so a gem restored by undo keeps its original (old) timestamp.
   * Purely a presentation hint (see PlacedGem's entrance animation): a gem
   * whose element mounts within moments of this timestamp plays the
   * celebratory placement pop; one that mounts long after (e.g. brought
   * back by undo) just fades in.
   */
  readonly createdAt: number;
}

/** Render-ready view of a placed gem, resolved against the catalogue. */
export interface PlacedGemView extends PlacedGem {
  readonly asset: GemAsset;
  readonly width: number;
  readonly height: number;
}
