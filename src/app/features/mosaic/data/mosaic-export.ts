import { Service } from '@angular/core';
import { MOSAIC_CANVAS_LOGICAL_SIZE, MOSAIC_CELL_GEM_MARGIN, MOSAIC_EXPORT_PIXEL_SIZE } from './mosaic.constants';
import { MosaicCell, MosaicResolution } from './mosaic-models';
import { getGemColourSwatch } from './gem-colour-catalogue';
import { ExportOutcome, deliverPngBlob } from '../../../shared/data/png-delivery';
import { CanvasShapeId, computeCanvasDimensions, computeGridDimensions, getCanvasShape } from '../../../shared/data/canvas-shape';
import { drawTransformedPhoto } from '../../../shared/data/photo-transform';

export interface MosaicExportSnapshot {
  readonly backgroundColor: string;
  readonly canvasShapeId: CanvasShapeId;
  readonly photoUrl: string | null;
  readonly photoOffsetX: number;
  readonly photoOffsetY: number;
  readonly photoScale: number;
  readonly resolution: MosaicResolution;
  readonly cells: readonly MosaicCell[];
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
 * Renders the current mosaic to a PNG via Canvas 2D — independent of the
 * DOM, so grid lines, hover previews, panels and toolbars never appear in
 * the export regardless of what's currently shown on screen (including the
 * view-only zoom/pan, which this ignores entirely). Delivery (share/
 * download/preview fallback) is shared with the freehand editor's exporter.
 */
@Service()
export class MosaicExport {
  async exportPng(snapshot: MosaicExportSnapshot, fileName = 'bedazzle-mosaic.png'): Promise<ExportOutcome> {
    const shape = getCanvasShape(snapshot.canvasShapeId);
    const logical = computeCanvasDimensions(shape.ratio, MOSAIC_CANVAS_LOGICAL_SIZE);
    const exportDims = computeCanvasDimensions(shape.ratio, MOSAIC_EXPORT_PIXEL_SIZE);
    const { cols, rows } = computeGridDimensions(shape.ratio, snapshot.resolution);

    const canvas = document.createElement('canvas');
    canvas.width = Math.round(exportDims.width);
    canvas.height = Math.round(exportDims.height);
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Your browser does not support exporting images.');
    }

    const gemSources = snapshot.cells.map((cell) => getGemColourSwatch(cell.colourId)?.gemSrc ?? '');
    const [photoImage, gemImages] = await Promise.all([
      snapshot.photoUrl ? loadImage(snapshot.photoUrl) : Promise.resolve(null),
      Promise.all(gemSources.map((src) => loadImage(resolveAssetUrl(src)))),
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

    const cellWidth = canvas.width / cols;
    const cellHeight = canvas.height / rows;
    const marginX = cellWidth * MOSAIC_CELL_GEM_MARGIN;
    const marginY = cellHeight * MOSAIC_CELL_GEM_MARGIN;
    const gemWidth = cellWidth - marginX * 2;
    const gemHeight = cellHeight - marginY * 2;
    snapshot.cells.forEach((cell, index) => {
      const image = gemImages[index];
      const x = cell.col * cellWidth + marginX;
      const y = cell.row * cellHeight + marginY;
      ctx.drawImage(image, x, y, gemWidth, gemHeight);
    });

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
    if (!blob) {
      throw new Error('Could not generate the PNG file.');
    }

    return deliverPngBlob(blob, fileName);
  }
}
