import { MosaicResolution } from './mosaic-models';

/** Reference "long side" of the logical mosaic canvas, in the same units the
 * photo pan/zoom offset is stored in — mirrors the freehand editor's
 * CANVAS_LOGICAL_SIZE, kept separate since the two modes are independent. */
export const MOSAIC_CANVAS_LOGICAL_SIZE = 1000;

/** Reference "long side" of the exported mosaic PNG, in device pixels — kept
 * separate from the freehand editor's EXPORT_PIXEL_SIZE since the two modes
 * are independent. The actual export width/height are derived from this
 * against the selected canvas shape (see MosaicEditorStore). */
export const MOSAIC_EXPORT_PIXEL_SIZE = 2048;

export const MOSAIC_RESOLUTIONS: readonly MosaicResolution[] = [16, 32, 64];
export const MOSAIC_DEFAULT_RESOLUTION: MosaicResolution = 32;

/** Brush sizes for Paint/Eraser, in cells-per-side of the (square) brush
 * footprint — e.g. 3 paints/erases a 3x3 block centered on the cursor. */
export const MOSAIC_BRUSH_SIZES: readonly number[] = [1, 2, 3, 4, 5];
export const MOSAIC_DEFAULT_BRUSH_SIZE = 1;

/** Photo pan/zoom: 1 = the default "cover" fit (fills the canvas, no gaps). */
export const MOSAIC_PHOTO_ZOOM_MIN = 1;
export const MOSAIC_PHOTO_ZOOM_MAX = 2.5;
export const MOSAIC_PHOTO_ZOOM_DEFAULT = 1;

/** Fraction of a cell's size left as margin around its gem (each side). */
export const MOSAIC_CELL_GEM_MARGIN = 0.08;

export const MOSAIC_UNDO_HISTORY_LIMIT = 50;

export const MOSAIC_ZOOM_MIN = 1;
export const MOSAIC_ZOOM_MAX = 6;
export const MOSAIC_ZOOM_STEP = 0.25;

export const MOSAIC_DEFAULT_BACKGROUND_COLOR = '#fdf8f2';

// --- Micro-interaction timing (mirrors the freehand editor's constants) ------
export const MOSAIC_GEM_FRESHNESS_WINDOW_MS = 400;
export const MOSAIC_RESTART_EXIT_MS = 180;
