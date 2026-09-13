import { Service } from '@angular/core';
import { CANVAS_LOGICAL_SIZE, EXPORT_PIXEL_SIZE } from './editor.constants';
import { PlacedGemView } from './editor-models';
import { CanvasShapeId, computeCanvasDimensions, getCanvasShape } from '../../../shared/data/canvas-shape';
import { drawTransformedPhoto } from '../../../shared/data/photo-transform';

export interface ExportSnapshot {
  readonly backgroundColor: string;
  readonly canvasShapeId: CanvasShapeId;
  readonly photoUrl: string | null;
  readonly photoOffsetX: number;
  readonly photoOffsetY: number;
  readonly photoScale: number;
  readonly gems: readonly PlacedGemView[];
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Could not load image: ${src}`));
    img.src = src;
  });
}

function resolveAssetUrl(path: string): string {
  return new URL(path, document.baseURI).href;
}

/**
 * Renders the current design to a PNG via Canvas 2D (independent of the DOM,
 * so panels/toolbars/selection outlines never appear in the export). Returns
 * the rendered blob rather than delivering it — the caller (the shared
 * SaveDialog) decides how the user actually gets it (download vs. share).
 */
@Service()
export class PngExport {
  async renderPng(snapshot: ExportSnapshot): Promise<Blob> {
    const shape = getCanvasShape(snapshot.canvasShapeId);
    const logical = computeCanvasDimensions(shape.ratio, CANVAS_LOGICAL_SIZE);
    const exportDims = computeCanvasDimensions(shape.ratio, EXPORT_PIXEL_SIZE);

    const canvas = document.createElement('canvas');
    canvas.width = Math.round(exportDims.width);
    canvas.height = Math.round(exportDims.height);
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Your browser does not support exporting images.');
    }

    const [photoImage, gemImages] = await Promise.all([
      snapshot.photoUrl ? loadImage(snapshot.photoUrl) : Promise.resolve(null),
      Promise.all(snapshot.gems.map((gem) => loadImage(resolveAssetUrl(gem.asset.src)))),
    ]);

    ctx.fillStyle = snapshot.backgroundColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (photoImage) {
      drawTransformedPhoto(
        ctx,
        photoImage,
        canvas.width,
        canvas.height,
        logical.width,
        logical.height,
        snapshot.photoOffsetX,
        snapshot.photoOffsetY,
        snapshot.photoScale,
      );
    }

    // Uniform regardless of shape: both logical and export dimensions are
    // derived from the same long-side reference, so the scale factor between
    // them is identical on both axes.
    const pixelsPerUnit = EXPORT_PIXEL_SIZE / CANVAS_LOGICAL_SIZE;
    snapshot.gems.forEach((gem, index) => {
      const image = gemImages[index];
      const width = gem.width * pixelsPerUnit;
      const height = gem.height * pixelsPerUnit;
      const x = gem.x * pixelsPerUnit - width / 2;
      const y = gem.y * pixelsPerUnit - height / 2;
      ctx.drawImage(image, x, y, width, height);
    });

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
    if (!blob) {
      throw new Error('Could not generate the PNG file.');
    }

    return blob;
  }
}
