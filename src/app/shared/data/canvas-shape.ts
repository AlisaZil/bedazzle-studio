/** The artboard's shape — shared between the freehand and mosaic editors so
 * both offer the same presets with one definition. */
export type CanvasShapeId = 'square' | 'portrait' | 'landscape';

export interface CanvasShapePreset {
  readonly id: CanvasShapeId;
  readonly label: string;
  /** width / height */
  readonly ratio: number;
}

export const CANVAS_SHAPE_PRESETS: readonly CanvasShapePreset[] = [
  { id: 'square', label: 'Square', ratio: 1 },
  { id: 'portrait', label: 'Portrait', ratio: 3 / 4 },
  { id: 'landscape', label: 'Landscape', ratio: 4 / 3 },
];

export const DEFAULT_CANVAS_SHAPE_ID: CanvasShapeId = 'square';

export function getCanvasShape(id: CanvasShapeId): CanvasShapePreset {
  return CANVAS_SHAPE_PRESETS.find((p) => p.id === id) ?? CANVAS_SHAPE_PRESETS[0];
}

/** Derives logical width/height from a shape ratio, keeping the longer side
 * fixed at `longSide` — so gem/cell sizes stay visually consistent when the
 * shape changes, only the shorter side grows or shrinks. */
export function computeCanvasDimensions(ratio: number, longSide: number): { width: number; height: number } {
  return ratio >= 1 ? { width: longSide, height: longSide / ratio } : { width: longSide * ratio, height: longSide };
}

/** Same shape as `computeCanvasDimensions`, for a grid: `longSideCells` cells
 * run along the artboard's longer side, and the shorter side gets however
 * many whole cells keep every cell square. For this app's shape presets
 * (ratios of 1, 3/4, 4/3) against resolutions 16/32/64 this always divides
 * evenly (e.g. 32 * 3/4 = 24), so no cropped/partial cells ever result. */
export function computeGridDimensions(ratio: number, longSideCells: number): { cols: number; rows: number } {
  const { width, height } = computeCanvasDimensions(ratio, longSideCells);
  return { cols: Math.round(width), rows: Math.round(height) };
}
