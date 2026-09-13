import { Service, computed, signal } from '@angular/core';
import {
  MOSAIC_BRUSH_SIZES,
  MOSAIC_CANVAS_LOGICAL_SIZE,
  MOSAIC_DEFAULT_BACKGROUND_COLOR,
  MOSAIC_DEFAULT_BRUSH_SIZE,
  MOSAIC_DEFAULT_RESOLUTION,
  MOSAIC_PHOTO_ZOOM_DEFAULT,
  MOSAIC_PHOTO_ZOOM_MAX,
  MOSAIC_PHOTO_ZOOM_MIN,
  MOSAIC_UNDO_HISTORY_LIMIT,
} from './mosaic.constants';
import { CanvasMode, MosaicCell, MosaicResolution, MosaicSnapshot, MosaicTool } from './mosaic-models';
import { GEM_COLOUR_CATALOGUE } from './gem-colour-catalogue';
import { CanvasShapeId, DEFAULT_CANVAS_SHAPE_ID, computeCanvasDimensions, computeGridDimensions, getCanvasShape } from '../../../shared/data/canvas-shape';

function cellKey(row: number, col: number): string {
  return `${row}:${col}`;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Owns all gem-mosaic state: grid resolution, cells (keyed by row/column —
 * never screen position, so the artwork is stable across viewport/zoom/pan),
 * background, palette selection, tool, and undo history. Fully independent
 * of the freehand EditorStore, so switching editing modes never touches the
 * other mode's artwork.
 *
 * A resolution or canvas shape change is itself undoable: the undo stack
 * stores {resolution, shapeId, cells} snapshots, so undoing either restores
 * the previous grid size/shape and whatever was on it.
 */
@Service()
export class MosaicEditorStore {
  private readonly _mode = signal<CanvasMode>('photo');
  private readonly _backgroundColor = signal(MOSAIC_DEFAULT_BACKGROUND_COLOR);
  private readonly _photoUrl = signal<string | null>(null);
  /** Pan (logical units, canvas-center-relative) and zoom (1 = default cover
   * fit) for the uploaded photo — reset whenever a new photo is set. Not
   * part of undo history, same as the freehand editor's photo pan/zoom. */
  private readonly _photoOffsetX = signal(0);
  private readonly _photoOffsetY = signal(0);
  private readonly _photoScale = signal(MOSAIC_PHOTO_ZOOM_DEFAULT);

  private readonly _canvasShapeId = signal<CanvasShapeId>(DEFAULT_CANVAS_SHAPE_ID);
  private readonly _resolution = signal<MosaicResolution>(MOSAIC_DEFAULT_RESOLUTION);
  private readonly _showGrid = signal(true);
  private readonly _gridOpacity = signal(0.35);
  private readonly _cells = signal<ReadonlyMap<string, MosaicCell>>(new Map());

  private readonly _selectedColourId = signal<string>(GEM_COLOUR_CATALOGUE[0].id);
  private readonly _tool = signal<MosaicTool>('paint');
  private readonly _brushSize = signal(MOSAIC_DEFAULT_BRUSH_SIZE);

  private readonly _undoStack = signal<readonly MosaicSnapshot[]>([]);
  private _strokeSnapshot: MosaicSnapshot | null = null;

  readonly mode = this._mode.asReadonly();
  readonly backgroundColor = this._backgroundColor.asReadonly();
  readonly photoUrl = this._photoUrl.asReadonly();
  readonly photoOffsetX = this._photoOffsetX.asReadonly();
  readonly photoOffsetY = this._photoOffsetY.asReadonly();
  readonly photoScale = this._photoScale.asReadonly();
  readonly photoZoomRange = { min: MOSAIC_PHOTO_ZOOM_MIN, max: MOSAIC_PHOTO_ZOOM_MAX } as const;
  readonly canvasShapeId = this._canvasShapeId.asReadonly();
  /** The canvas's logical width/height, for photo pan/zoom maths — mirrors
   * EditorStore.canvasWidth/canvasHeight. */
  readonly canvasWidth = computed(() => computeCanvasDimensions(getCanvasShape(this._canvasShapeId()).ratio, MOSAIC_CANVAS_LOGICAL_SIZE).width);
  readonly canvasHeight = computed(() => computeCanvasDimensions(getCanvasShape(this._canvasShapeId()).ratio, MOSAIC_CANVAS_LOGICAL_SIZE).height);
  readonly resolution = this._resolution.asReadonly();
  readonly showGrid = this._showGrid.asReadonly();
  readonly gridOpacity = this._gridOpacity.asReadonly();
  readonly selectedColourId = this._selectedColourId.asReadonly();
  readonly tool = this._tool.asReadonly();
  readonly brushSize = this._brushSize.asReadonly();
  readonly brushSizes = MOSAIC_BRUSH_SIZES;

  /** The grid's actual column/row counts — `resolution` cells run along the
   * canvas's longer side; the shorter side is derived so every cell stays
   * square regardless of shape. */
  readonly gridDimensions = computed(() => computeGridDimensions(getCanvasShape(this._canvasShapeId()).ratio, this._resolution()));

  readonly cells = computed(() => Array.from(this._cells().values()));
  readonly cellCount = computed(() => this._cells().size);
  readonly canUndo = computed(() => this._undoStack().length > 0);
  readonly canRestart = computed(() => this._cells().size > 0);

  cellAt(row: number, col: number): MosaicCell | undefined {
    return this._cells().get(cellKey(row, col));
  }

  // --- Background -------------------------------------------------------------

  setMode(mode: CanvasMode): void {
    this._mode.set(mode);
  }

  setPhotoUrl(url: string | null): void {
    const previous = this._photoUrl();
    if (previous) {
      URL.revokeObjectURL(previous);
    }
    this._photoUrl.set(url);
    // A newly uploaded/replaced photo starts centered and unzoomed again.
    this._photoOffsetX.set(0);
    this._photoOffsetY.set(0);
    this._photoScale.set(MOSAIC_PHOTO_ZOOM_DEFAULT);
  }

  setPhotoOffset(x: number, y: number): void {
    this._photoOffsetX.set(x);
    this._photoOffsetY.set(y);
  }

  setPhotoScale(scale: number): void {
    this._photoScale.set(clamp(scale, MOSAIC_PHOTO_ZOOM_MIN, MOSAIC_PHOTO_ZOOM_MAX));
  }

  // --- Palette / tool -----------------------------------------------------------

  setSelectedColour(id: string): void {
    this._selectedColourId.set(id);
  }

  setTool(tool: MosaicTool): void {
    this._tool.set(tool);
  }

  setBrushSize(size: number): void {
    if (!MOSAIC_BRUSH_SIZES.includes(size)) return;
    this._brushSize.set(size);
  }

  setShowGrid(show: boolean): void {
    this._showGrid.set(show);
  }

  setGridOpacity(opacity: number): void {
    this._gridOpacity.set(Math.min(1, Math.max(0, opacity)));
  }

  // --- Resolution (undoable, clears the grid) ------------------------------------

  /** Applies a confirmed resolution change: starts a fresh (empty) grid at
   * the new size, remembering the old size + cells so undo can restore them. */
  changeResolution(next: MosaicResolution): void {
    if (next === this._resolution()) return;
    this.pushUndo();
    this._resolution.set(next);
    this._cells.set(new Map());
  }

  /** Applies a confirmed canvas shape change: starts a fresh (empty) grid at
   * the new shape, remembering the old shape + cells so undo can restore them. */
  changeCanvasShape(next: CanvasShapeId): void {
    if (next === this._canvasShapeId()) return;
    this.pushUndo();
    this._canvasShapeId.set(next);
    this._cells.set(new Map());
  }

  // --- Painting -------------------------------------------------------------

  /** Brackets a paint/erase stroke (a click, or a whole drag) so every cell
   * touched during it collapses into a single undo step. */
  beginStroke(): void {
    this._strokeSnapshot = { resolution: this._resolution(), shapeId: this._canvasShapeId(), cells: this.cells() };
  }

  endStroke(): void {
    const snapshot = this._strokeSnapshot;
    this._strokeSnapshot = null;
    if (!snapshot) return;
    if (snapshot.cells === this.cells()) return; // nothing actually changed
    this.commitUndoSnapshot(snapshot);
  }

  /** Paints or erases every cell under the current brush footprint (a single
   * cell when brush size is 1) centered on (row, col), using the current
   * tool — a no-op per-cell if it's already in the target state, so a stroke
   * re-visiting the same cells (or overlapping itself) never creates
   * redundant work. */
  applyToolAt(row: number, col: number): void {
    const cells = this.brushFootprint(row, col);
    if (this._tool() === 'eraser') {
      for (const cell of cells) this.eraseCellInternal(cell.row, cell.col);
    } else {
      for (const cell of cells) this.paintCellInternal(cell.row, cell.col);
    }
  }

  /** The (grid-bounds-clamped) cells covered by the current brush size when
   * centered on (row, col) — a square footprint, biased toward the
   * bottom-right for even sizes (there's no single "center" cell then). */
  private brushFootprint(row: number, col: number): Array<{ row: number; col: number }> {
    const size = this._brushSize();
    const before = Math.floor((size - 1) / 2);
    const after = size - 1 - before;
    const { rows, cols } = this.gridDimensions();
    const cells: Array<{ row: number; col: number }> = [];
    for (let r = Math.max(0, row - before); r <= Math.min(rows - 1, row + after); r++) {
      for (let c = Math.max(0, col - before); c <= Math.min(cols - 1, col + after); c++) {
        cells.push({ row: r, col: c });
      }
    }
    return cells;
  }

  private paintCellInternal(row: number, col: number): void {
    const key = cellKey(row, col);
    const colourId = this._selectedColourId();
    const existing = this._cells().get(key);
    if (existing?.colourId === colourId) return;
    this._cells.update((cells) => {
      const next = new Map(cells);
      next.set(key, { row, col, colourId, createdAt: Date.now() });
      return next;
    });
  }

  private eraseCellInternal(row: number, col: number): void {
    const key = cellKey(row, col);
    if (!this._cells().has(key)) return;
    this._cells.update((cells) => {
      const next = new Map(cells);
      next.delete(key);
      return next;
    });
  }

  // --- Restart -------------------------------------------------------

  restart(): void {
    if (this._cells().size === 0) return;
    this.pushUndo();
    this._cells.set(new Map());
  }

  // --- Undo -------------------------------------------------------------------

  undo(): void {
    this._undoStack.update((stack) => {
      if (stack.length === 0) return stack;
      const previous = stack[stack.length - 1];
      this._resolution.set(previous.resolution);
      this._canvasShapeId.set(previous.shapeId);
      this._cells.set(new Map(previous.cells.map((cell) => [cellKey(cell.row, cell.col), cell])));
      return stack.slice(0, -1);
    });
  }

  private pushUndo(): void {
    this.commitUndoSnapshot({ resolution: this._resolution(), shapeId: this._canvasShapeId(), cells: this.cells() });
  }

  private commitUndoSnapshot(snapshot: MosaicSnapshot): void {
    this._undoStack.update((stack) => {
      const next = [...stack, snapshot];
      return next.length > MOSAIC_UNDO_HISTORY_LIMIT ? next.slice(next.length - MOSAIC_UNDO_HISTORY_LIMIT) : next;
    });
  }
}
