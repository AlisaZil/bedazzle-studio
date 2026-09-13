import { Service, computed, signal } from '@angular/core';
import {
  CANVAS_LOGICAL_SIZE,
  DEFAULT_BACKGROUND_COLOR,
  GEM_SIZE_DEFAULT,
  GEM_SIZE_MAX,
  GEM_SIZE_MIN,
  PHOTO_ZOOM_DEFAULT,
  PHOTO_ZOOM_MAX,
  PHOTO_ZOOM_MIN,
  UNDO_HISTORY_LIMIT,
} from './editor.constants';
import { CanvasMode, GemAsset, GemFilterId, PlacedGem, PlacedGemView } from './editor-models';
import { GEM_CATALOGUE, getGemAsset } from './gem-catalogue';
import { CanvasShapeId, DEFAULT_CANVAS_SHAPE_ID, computeCanvasDimensions, getCanvasShape } from '../../../shared/data/canvas-shape';

/** What the undo stack stores — the canvas shape is included because changing
 * it is itself an undoable action (undo must restore the previous shape and
 * whatever gems were on it). */
interface EditorSnapshot {
  readonly shapeId: CanvasShapeId;
  readonly gems: readonly PlacedGem[];
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function gemDimensions(size: number, aspect: number): { width: number; height: number } {
  return aspect >= 1 ? { width: size, height: size / aspect } : { width: size * aspect, height: size };
}

/** Keeps a gem's full bounding box inside its canvas axis, centering it if it doesn't fit. */
function clampCenter(value: number, size: number, canvasExtent: number): number {
  const half = size / 2;
  if (size >= canvasExtent) {
    return canvasExtent / 2;
  }
  return clamp(value, half, canvasExtent - half);
}

let nextId = 0;
function createId(prefix: string): string {
  nextId += 1;
  return `${prefix}-${Date.now().toString(36)}-${nextId}`;
}

/**
 * Owns all bedazzle editor state: canvas background, placed gems, the active
 * gem library selection, and undo history. Every mutation that should be
 * undoable snapshots the gem list first; in-progress gestures (drag, resize)
 * snapshot once at gesture start and commit once at gesture end, so a whole
 * drag collapses into a single undo step.
 */
@Service()
export class EditorStore {
  private readonly _mode = signal<CanvasMode>('photo');
  private readonly _backgroundColor = signal<string>(DEFAULT_BACKGROUND_COLOR);
  private readonly _photoUrl = signal<string | null>(null);
  private readonly _canvasShapeId = signal<CanvasShapeId>(DEFAULT_CANVAS_SHAPE_ID);
  /** Pan (logical units, canvas-center-relative) and zoom (1 = default cover
   * fit) for the uploaded photo — reset whenever a new photo is set. Not
   * part of undo history, same as mode/background. */
  private readonly _photoOffsetX = signal(0);
  private readonly _photoOffsetY = signal(0);
  private readonly _photoScale = signal(PHOTO_ZOOM_DEFAULT);

  private readonly _gems = signal<readonly PlacedGem[]>([]);
  private readonly _selectedGemId = signal<string | null>(null);

  private readonly _activeCategory = signal<GemFilterId>('all');
  private readonly _activeAssetId = signal<string>(GEM_CATALOGUE[0].id);
  private readonly _newGemSize = signal<number>(GEM_SIZE_DEFAULT);
  /** When on, placing a gem picks a random asset (from the active category)
   * and a randomized size instead of the gem library's current selection —
   * toggled by the toolbar's Random button, which stays highlighted while
   * it's active, same as Undo/Restart aren't "sticky" but Size's popover is. */
  private readonly _randomMode = signal(false);

  private readonly _undoStack = signal<readonly EditorSnapshot[]>([]);
  private _gestureSnapshot: EditorSnapshot | null = null;

  readonly mode = this._mode.asReadonly();
  readonly backgroundColor = this._backgroundColor.asReadonly();
  readonly photoUrl = this._photoUrl.asReadonly();
  readonly canvasShapeId = this._canvasShapeId.asReadonly();
  /** The canvas's actual width/height in logical units — derived from the
   * selected shape against CANVAS_LOGICAL_SIZE's long-side reference, so gem
   * positions/sizes stay meaningful regardless of shape. */
  readonly canvasWidth = computed(() => computeCanvasDimensions(getCanvasShape(this._canvasShapeId()).ratio, CANVAS_LOGICAL_SIZE).width);
  readonly canvasHeight = computed(() => computeCanvasDimensions(getCanvasShape(this._canvasShapeId()).ratio, CANVAS_LOGICAL_SIZE).height);
  readonly photoOffsetX = this._photoOffsetX.asReadonly();
  readonly photoOffsetY = this._photoOffsetY.asReadonly();
  readonly photoScale = this._photoScale.asReadonly();
  readonly photoZoomRange = { min: PHOTO_ZOOM_MIN, max: PHOTO_ZOOM_MAX } as const;
  readonly selectedGemId = this._selectedGemId.asReadonly();
  readonly activeCategory = this._activeCategory.asReadonly();
  readonly activeAssetId = this._activeAssetId.asReadonly();
  readonly newGemSize = this._newGemSize.asReadonly();
  readonly randomMode = this._randomMode.asReadonly();

  readonly gemSizeRange = { min: GEM_SIZE_MIN, max: GEM_SIZE_MAX } as const;

  readonly gems = computed<readonly PlacedGemView[]>(() =>
    this._gems()
      .map((gem) => this.toView(gem))
      .filter((gem): gem is PlacedGemView => gem !== null)
      .sort((a, b) => a.z - b.z),
  );

  readonly selectedGem = computed<PlacedGemView | null>(() => {
    const id = this._selectedGemId();
    if (!id) return null;
    return this.gems().find((gem) => gem.id === id) ?? null;
  });

  readonly canUndo = computed(() => this._undoStack().length > 0);
  readonly canRestart = computed(() => this._gems().length > 0);

  private toView(gem: PlacedGem): PlacedGemView | null {
    const asset = getGemAsset(gem.assetId);
    if (!asset) return null;
    const { width, height } = gemDimensions(gem.size, asset.aspect);
    return { ...gem, asset, width, height };
  }

  private nextZ(): number {
    return this._gems().reduce((max, gem) => Math.max(max, gem.z), 0) + 1;
  }

  private pickRandomAsset(): GemAsset | undefined {
    const category = this._activeCategory();
    const pool = category === 'all' ? GEM_CATALOGUE : GEM_CATALOGUE.filter((asset) => asset.category === category);
    if (pool.length === 0) return undefined;
    return pool[Math.floor(Math.random() * pool.length)];
  }

  private pushUndo(): void {
    this._undoStack.update((stack) => {
      const next = [...stack, { shapeId: this._canvasShapeId(), gems: this._gems() }];
      return next.length > UNDO_HISTORY_LIMIT ? next.slice(next.length - UNDO_HISTORY_LIMIT) : next;
    });
  }

  // --- Canvas mode / background -------------------------------------------------

  setMode(mode: CanvasMode): void {
    this._mode.set(mode);
  }

  /** Applies a confirmed shape change: starts a fresh (empty) canvas at the
   * new shape, remembering the old shape + gems so undo can restore them. */
  changeCanvasShape(next: CanvasShapeId): void {
    if (next === this._canvasShapeId()) return;
    this.pushUndo();
    this._canvasShapeId.set(next);
    this._gems.set([]);
    this._selectedGemId.set(null);
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
    this._photoScale.set(PHOTO_ZOOM_DEFAULT);
  }

  setPhotoOffset(x: number, y: number): void {
    this._photoOffsetX.set(x);
    this._photoOffsetY.set(y);
  }

  setPhotoScale(scale: number): void {
    this._photoScale.set(clamp(scale, PHOTO_ZOOM_MIN, PHOTO_ZOOM_MAX));
  }

  // --- Gem library selection ------------------------------------------------

  setActiveCategory(category: GemFilterId): void {
    this._activeCategory.set(category);
  }

  setActiveAsset(assetId: string): void {
    this._activeAssetId.set(assetId);
  }

  setNewGemSize(size: number): void {
    this._newGemSize.set(clamp(size, GEM_SIZE_MIN, GEM_SIZE_MAX));
  }

  toggleRandomMode(): void {
    this._randomMode.update((value) => !value);
  }

  // --- Selection -------------------------------------------------------------

  selectGem(id: string | null): void {
    this._selectedGemId.set(id);
  }

  // --- Placement ---------------------------------------------------------------

  placeGem(x: number, y: number): void {
    const asset = this._randomMode() ? this.pickRandomAsset() : getGemAsset(this._activeAssetId());
    if (!asset) return;
    this.pushUndo();
    const baseSize = this._newGemSize();
    const size = this._randomMode() ? clamp(baseSize * (0.6 + Math.random() * 0.8), GEM_SIZE_MIN, GEM_SIZE_MAX) : baseSize;
    const { width, height } = gemDimensions(size, asset.aspect);
    const gem: PlacedGem = {
      id: createId('gem'),
      assetId: asset.id,
      x: clampCenter(x, width, this.canvasWidth()),
      y: clampCenter(y, height, this.canvasHeight()),
      size,
      z: this.nextZ(),
      createdAt: Date.now(),
    };
    this._gems.update((gems) => [...gems, gem]);
    this._selectedGemId.set(gem.id);
  }

  // --- Dragging (one undo entry per full gesture) -------------------------------

  beginDrag(): void {
    this._gestureSnapshot = { shapeId: this._canvasShapeId(), gems: this._gems() };
  }

  updateDragPosition(id: string, x: number, y: number): void {
    this._gems.update((gems) =>
      gems.map((gem) => {
        if (gem.id !== id) return gem;
        const asset = getGemAsset(gem.assetId);
        const { width, height } = gemDimensions(gem.size, asset?.aspect ?? 1);
        return { ...gem, x: clampCenter(x, width, this.canvasWidth()), y: clampCenter(y, height, this.canvasHeight()) };
      }),
    );
  }

  endDrag(): void {
    this.commitGesture();
  }

  // --- Resizing the selected gem (one undo entry per full gesture) -------------

  beginResize(): void {
    this._gestureSnapshot = { shapeId: this._canvasShapeId(), gems: this._gems() };
  }

  updateSelectedSize(size: number): void {
    const id = this._selectedGemId();
    if (!id) return;
    const clamped = clamp(size, GEM_SIZE_MIN, GEM_SIZE_MAX);
    this._gems.update((gems) =>
      gems.map((gem) => {
        if (gem.id !== id) return gem;
        const asset = getGemAsset(gem.assetId);
        const { width, height } = gemDimensions(clamped, asset?.aspect ?? 1);
        return { ...gem, size: clamped, x: clampCenter(gem.x, width, this.canvasWidth()), y: clampCenter(gem.y, height, this.canvasHeight()) };
      }),
    );
  }

  endResize(): void {
    this.commitGesture();
  }

  private commitGesture(): void {
    const snapshot = this._gestureSnapshot;
    this._gestureSnapshot = null;
    if (!snapshot || snapshot.gems === this._gems()) return;
    this._undoStack.update((stack) => {
      const next = [...stack, snapshot];
      return next.length > UNDO_HISTORY_LIMIT ? next.slice(next.length - UNDO_HISTORY_LIMIT) : next;
    });
  }

  // --- Duplicate / delete ------------------------------------------------------

  duplicateSelected(): void {
    const selected = this._gems().find((gem) => gem.id === this._selectedGemId());
    if (!selected) return;
    this.pushUndo();
    const asset = getGemAsset(selected.assetId);
    const { width, height } = gemDimensions(selected.size, asset?.aspect ?? 1);
    const offset = Math.max(selected.size * 0.18, 16);
    const copy: PlacedGem = {
      ...selected,
      id: createId('gem'),
      x: clampCenter(selected.x + offset, width, this.canvasWidth()),
      y: clampCenter(selected.y + offset, height, this.canvasHeight()),
      z: this.nextZ(),
      createdAt: Date.now(),
    };
    this._gems.update((gems) => [...gems, copy]);
    this._selectedGemId.set(copy.id);
  }

  deleteSelected(): void {
    const id = this._selectedGemId();
    if (!id) return;
    this.deleteGemById(id);
  }

  /**
   * Deletes a specific gem regardless of current selection — used by the
   * page's delete flow, which clears the selection immediately (so its
   * controls disappear right away) but defers the actual removal until a
   * short fade-out has played.
   */
  deleteGemById(id: string): void {
    if (!this._gems().some((gem) => gem.id === id)) return;
    this.pushUndo();
    this._gems.update((gems) => gems.filter((gem) => gem.id !== id));
    if (this._selectedGemId() === id) {
      this._selectedGemId.set(null);
    }
  }

  // --- Undo / restart --------------------------------------------------------------

  /** What `undo()` would restore, without applying it — lets the page fade
   * out gems that undo is about to remove before committing the change. */
  peekUndo(): readonly PlacedGem[] | null {
    const stack = this._undoStack();
    return stack.length ? stack[stack.length - 1].gems : null;
  }

  undo(): void {
    this._undoStack.update((stack) => {
      if (stack.length === 0) return stack;
      const previous = stack[stack.length - 1];
      this._canvasShapeId.set(previous.shapeId);
      this._gems.set(previous.gems);
      if (!previous.gems.some((gem) => gem.id === this._selectedGemId())) {
        this._selectedGemId.set(null);
      }
      return stack.slice(0, -1);
    });
  }

  restart(): void {
    if (this._gems().length === 0) return;
    this.pushUndo();
    this._gems.set([]);
    this._selectedGemId.set(null);
  }
}
