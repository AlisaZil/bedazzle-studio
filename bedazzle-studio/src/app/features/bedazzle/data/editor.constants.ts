/** Reference "long side" of the logical canvas, in the same units gem
 * positions/sizes are stored in (so the artwork never changes when the
 * viewport is resized). The canvas is no longer always square — its actual
 * width/height are derived from the chosen CanvasShapeId against this long
 * side (see EditorStore.canvasWidth/canvasHeight) — but this stays the one
 * fixed reference so gem sizes look consistent across shapes. */
export const CANVAS_LOGICAL_SIZE = 1000;

export const GEM_SIZE_MIN = 40;
export const GEM_SIZE_MAX = 200;
export const GEM_SIZE_DEFAULT = 90;

/** Reference "long side" of the exported PNG, in device pixels — the actual
 * export width/height are derived from this against the selected canvas
 * shape, same as CANVAS_LOGICAL_SIZE. */
export const EXPORT_PIXEL_SIZE = 2048;

/** Cap on stored undo snapshots, to bound memory for long sessions. */
export const UNDO_HISTORY_LIMIT = 50;

export const DEFAULT_BACKGROUND_COLOR = '#fdf8f2';

/** Photo pan/zoom: 1 = the default "cover" fit (fills the canvas, no gaps). */
export const PHOTO_ZOOM_MIN = 1;
export const PHOTO_ZOOM_MAX = 2.5;
export const PHOTO_ZOOM_DEFAULT = 1;

// --- Micro-interaction timing --------------------------------------------------
// Kept alongside the CSS motion tokens (src/styles.scss --motion-*) since these
// drive setTimeout delays in TS that must match the CSS transition/animation
// durations they're paired with.

/** A gem younger than this (ms) at mount time is a genuine new placement and
 * gets the celebratory pop + sparkles; older (e.g. restored by undo) just fades in. */
export const GEM_FRESHNESS_WINDOW_MS = 400;

/** How long a deleted/undone gem fades out before it's actually removed from state. */
export const GEM_EXIT_MS = 150;

/** How long all gems fade out on restart, after confirmation. */
export const RESTART_EXIT_MS = 180;

/** How long the Save button shows its success checkmark before reverting. */
export const SAVE_SUCCESS_MS = 1500;
