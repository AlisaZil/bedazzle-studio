/**
 * Shared "cover + user pan/zoom" maths for an uploaded photo, used by both
 * editors: DesignCanvas/MosaicCanvas call `computePhotoBox` to size/position
 * the on-screen <img>, and PngExport/MosaicExport call `drawTransformedPhoto`
 * to render the identical box into the export canvas — so display and
 * export can never drift apart.
 */

export interface PhotoBox {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

/** The base "object-fit: cover" scale for fitting `naturalW x naturalH` into
 * `boxW x boxH` without stretching. */
function coverScaleFor(naturalW: number, naturalH: number, boxW: number, boxH: number): number {
  return Math.max(boxW / naturalW, boxH / naturalH);
}

/**
 * The photo's box in the same logical units as gems/cells: a base cover fit
 * into `canvasWidth x canvasHeight`, then the user's extra pan (offsetX/Y)
 * and zoom (scale, 1 = the cover fit) on top.
 */
export function computePhotoBox(
  naturalW: number,
  naturalH: number,
  canvasWidth: number,
  canvasHeight: number,
  offsetX: number,
  offsetY: number,
  scale: number,
): PhotoBox {
  const finalScale = coverScaleFor(naturalW, naturalH, canvasWidth, canvasHeight) * scale;
  const width = naturalW * finalScale;
  const height = naturalH * finalScale;
  const centerX = canvasWidth / 2 + offsetX;
  const centerY = canvasHeight / 2 + offsetY;
  return { left: centerX - width / 2, top: centerY - height / 2, width, height };
}

/** Clamps a pan offset so the photo can never reveal empty space at its
 * edges, for the given natural size / canvas size / zoom. */
export function clampPhotoOffset(
  naturalW: number,
  naturalH: number,
  canvasWidth: number,
  canvasHeight: number,
  scale: number,
  x: number,
  y: number,
): { x: number; y: number } {
  const finalScale = coverScaleFor(naturalW, naturalH, canvasWidth, canvasHeight) * scale;
  const maxX = Math.max(0, (naturalW * finalScale - canvasWidth) / 2);
  const maxY = Math.max(0, (naturalH * finalScale - canvasHeight) / 2);
  return { x: Math.min(maxX, Math.max(-maxX, x)), y: Math.min(maxY, Math.max(-maxY, y)) };
}

/** Draws `img` into the export canvas using the same box `computePhotoBox`
 * would produce, scaled from logical units to the export's pixel size. */
export function drawTransformedPhoto(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  targetW: number,
  targetH: number,
  canvasWidth: number,
  canvasHeight: number,
  offsetX: number,
  offsetY: number,
  scale: number,
): void {
  const box = computePhotoBox(img.naturalWidth, img.naturalHeight, canvasWidth, canvasHeight, offsetX, offsetY, scale);
  const pixelsPerUnitX = targetW / canvasWidth;
  const pixelsPerUnitY = targetH / canvasHeight;
  ctx.drawImage(img, box.left * pixelsPerUnitX, box.top * pixelsPerUnitY, box.width * pixelsPerUnitX, box.height * pixelsPerUnitY);
}
