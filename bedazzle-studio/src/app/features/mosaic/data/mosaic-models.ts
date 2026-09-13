import { CanvasMode } from '../../bedazzle/data/editor-models';
import { CanvasShapeId } from '../../../shared/data/canvas-shape';

export type { CanvasMode };

/** Cells along the canvas's longer side — the shorter side's cell count is
 * derived from this against the current canvas shape (see
 * computeGridDimensions), so cells stay square regardless of shape. */
export type MosaicResolution = 16 | 32 | 64;

/** One gem colour in the 5x5 organiser palette. */
export interface GemColourSwatch {
  readonly id: string;
  readonly label: string;
  /** The filled organiser compartment — the picker button. */
  readonly compartmentSrc: string;
  /** The single round gem — what actually gets placed on the grid. */
  readonly gemSrc: string;
}

/** A filled cell. Cells are keyed by row/column, never by screen position,
 * so the artwork is stable across viewport size, zoom, and pan. */
export interface MosaicCell {
  readonly row: number;
  readonly col: number;
  readonly colourId: string;
  /** `Date.now()` when this exact cell object was created — same freshness
   * trick as the freehand editor's PlacedGem: a cell that mounts moments
   * after this timestamp plays the placement pop; one restored by undo
   * (an old cell object with an old timestamp) just appears. */
  readonly createdAt: number;
}

/** What the undo stack stores — resolution and shape are included because
 * changing either is itself an undoable action (undo must restore the
 * previous grid size/shape). */
export interface MosaicSnapshot {
  readonly resolution: MosaicResolution;
  readonly shapeId: CanvasShapeId;
  readonly cells: readonly MosaicCell[];
}

export type MosaicTool = 'paint' | 'eraser';
