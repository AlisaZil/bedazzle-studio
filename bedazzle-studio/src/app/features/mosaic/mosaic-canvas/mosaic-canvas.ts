import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  computed,
  effect,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { CanvasMode, MosaicCell, MosaicResolution, MosaicTool } from '../data/mosaic-models';
import { MOSAIC_CELL_GEM_MARGIN, MOSAIC_GEM_FRESHNESS_WINDOW_MS, MOSAIC_ZOOM_MAX, MOSAIC_ZOOM_MIN } from '../data/mosaic.constants';
import { getGemColourSwatch } from '../data/gem-colour-catalogue';
import { computeGridDimensions } from '../../../shared/data/canvas-shape';
import { clampPhotoOffset, computePhotoBox } from '../../../shared/data/photo-transform';
import { GemSizeControl } from '../../bedazzle/gem-size-control/gem-size-control';

export interface PhotoOffset {
  readonly x: number;
  readonly y: number;
}

export interface RowCol {
  readonly row: number;
  readonly col: number;
}

interface CellRect {
  readonly leftPct: number;
  readonly topPct: number;
  readonly widthPct: number;
  readonly heightPct: number;
}

/**
 * The mosaic grid surface: background (colour or photo), grid lines, placed
 * gems, and the desktop hover preview. Purely presentational — coordinate
 * math (pointer px -> row/column, accounting for the current zoom/pan) lives
 * here since this is the one place that knows the surface's rendered size,
 * but painting/undo state itself is owned by MosaicEditorStore and reported
 * upward via outputs. Zoom is lifted to the parent (so the sidebar's
 * ZoomControls can drive it too); pan and which-tool-is-a-two-finger-gesture
 * are local view state, same as `adjustingPhoto` was for the freehand canvas.
 */
@Component({
  selector: 'app-mosaic-canvas',
  imports: [GemSizeControl],
  templateUrl: './mosaic-canvas.html',
  styleUrl: './mosaic-canvas.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    // The parent (`.mosaic__canvas-region`) is a column flex container — a
    // flex item's cross axis (width) stretches by default, but its main axis
    // (height) does not, so without this the host has no intrinsic height,
    // `.mosaic-wrap`'s height:100% resolves to nothing, and the whole canvas
    // collapses to 0x0.
    style: 'display: flex; flex: 1; min-height: 0;',
  },
})
export class MosaicCanvas {
  readonly mode = input.required<CanvasMode>();
  readonly backgroundColor = input.required<string>();
  readonly photoUrl = input<string | null>(null);
  readonly resolution = input.required<MosaicResolution>();
  /** Canvas shape's width/height ratio — determines how many columns vs rows
   * the grid gets (see gridDimensions) and the surface's on-screen aspect. */
  readonly shapeRatio = input.required<number>();
  /** Canvas logical width/height, in the same units the photo pan/zoom
   * offset is stored in (mirrors DesignCanvas). */
  readonly canvasWidth = input.required<number>();
  readonly canvasHeight = input.required<number>();
  readonly showGrid = input(true);
  readonly gridOpacity = input(0.35);
  readonly cells = input.required<readonly MosaicCell[]>();
  readonly selectedColourId = input.required<string>();
  readonly tool = input.required<MosaicTool>();
  readonly brushSize = input(1);
  readonly zoom = input(1);
  readonly photoOffsetX = input(0);
  readonly photoOffsetY = input(0);
  readonly photoScale = input(1);
  readonly photoZoomMin = input(1);
  readonly photoZoomMax = input(2.5);
  /** Whether the pan tool is active — lifted to the parent so the bottom
   * toolbar's Pan button can drive it too (mirrors how `zoom` is lifted). */
  readonly panMode = input(false);

  readonly cellStrokeStart = output<void>();
  readonly cellPaint = output<RowCol>();
  readonly cellStrokeEnd = output<void>();
  readonly photoFileSelected = output<File>();
  readonly zoomChange = output<number>();
  readonly photoOffsetChange = output<PhotoOffset>();
  readonly photoScaleChange = output<number>();
  /** Mirrors `adjustingPhoto` outward, purely so the page can pick the right
   * hint-strip copy — the flag itself still lives here since it's a local
   * interaction mode, not artwork. */
  readonly adjustingPhotoChange = output<boolean>();

  private readonly viewport = viewChild.required<ElementRef<HTMLDivElement>>('viewport');
  private readonly surface = viewChild.required<ElementRef<HTMLDivElement>>('surface');
  private readonly fileInput = viewChild.required<ElementRef<HTMLInputElement>>('fileInput');

  protected readonly displayedPhotoUrl = signal<string | null>(null);
  protected readonly naturalSize = signal<{ w: number; h: number } | null>(null);
  /** Move/resize mode for the photo — initial positioning happens in the
   * upload-time PhotoSetupDialog instead, so this starts off and is only
   * toggled afterwards via the "Move & resize" chip, for repositioning later. */
  protected readonly adjustingPhoto = signal(false);
  private decodeToken = 0;

  private photoPanning = false;
  private photoPanStartClient: PhotoOffset = { x: 0, y: 0 };
  private photoPanStartOffset: PhotoOffset = { x: 0, y: 0 };

  protected readonly panX = signal(0);
  protected readonly panY = signal(0);
  protected readonly panning = signal(false);
  protected readonly hoverCell = signal<RowCol | null>(null);

  private spaceHeld = false;
  private strokeActive = false;
  private lastPaintedCell: RowCol | null = null;
  private readonly activePointers = new Map<number, { x: number; y: number }>();
  private gestureStartDistance = 0;
  private gestureStartZoom = 1;
  private gestureStartMid = { x: 0, y: 0 };
  private gestureStartPan = { x: 0, y: 0 };

  protected readonly gridDimensions = computed(() => computeGridDimensions(this.shapeRatio(), this.resolution()));
  protected readonly cellWidthPct = computed(() => 100 / this.gridDimensions().cols);
  protected readonly cellHeightPct = computed(() => 100 / this.gridDimensions().rows);
  protected readonly gemMarginXPct = computed(() => this.cellWidthPct() * MOSAIC_CELL_GEM_MARGIN);
  protected readonly gemMarginYPct = computed(() => this.cellHeightPct() * MOSAIC_CELL_GEM_MARGIN);
  protected readonly gemWidthPct = computed(() => this.cellWidthPct() - this.gemMarginXPct() * 2);
  protected readonly gemHeightPct = computed(() => this.cellHeightPct() - this.gemMarginYPct() * 2);

  protected readonly surfaceTransform = computed(
    () => `translate(${this.panX()}px, ${this.panY()}px) scale(${this.zoom()})`,
  );

  /** The photo's on-screen box, in the same logical units as the freehand
   * editor's — computed once the decoded image's natural size is known, via
   * the same shared maths MosaicExport uses, so display and export match. */
  protected readonly photoBox = computed(() => {
    const size = this.naturalSize();
    if (!size) return null;
    return computePhotoBox(
      size.w,
      size.h,
      this.canvasWidth(),
      this.canvasHeight(),
      this.photoOffsetX(),
      this.photoOffsetY(),
      this.photoScale(),
    );
  });

  protected readonly photoLeftPct = computed(() => ((this.photoBox()?.left ?? 0) / this.canvasWidth()) * 100);
  protected readonly photoTopPct = computed(() => ((this.photoBox()?.top ?? 0) / this.canvasHeight()) * 100);
  protected readonly photoWidthPct = computed(() => ((this.photoBox()?.width ?? this.canvasWidth()) / this.canvasWidth()) * 100);
  protected readonly photoHeightPct = computed(() => ((this.photoBox()?.height ?? this.canvasHeight()) / this.canvasHeight()) * 100);

  constructor() {
    effect(() => {
      const url = this.photoUrl();
      const token = ++this.decodeToken;
      if (!url) {
        this.displayedPhotoUrl.set(null);
        this.naturalSize.set(null);
        return;
      }
      const img = new Image();
      img.src = url;
      img
        .decode()
        .then(() => {
          if (token === this.decodeToken) {
            this.displayedPhotoUrl.set(url);
            this.naturalSize.set({ w: img.naturalWidth, h: img.naturalHeight });
          }
        })
        .catch(() => {});
    });
  }

  // --- Photo pan/zoom ------------------------------------------------------------

  toggleAdjustPhoto(event: Event): void {
    event.stopPropagation();
    this.adjustingPhoto.update((value) => !value);
    this.adjustingPhotoChange.emit(this.adjustingPhoto());
    if (this.adjustingPhoto()) {
      this.hoverCell.set(null);
    }
  }

  onZoomInput(value: number): void {
    this.photoScaleChange.emit(value);
    const corrected = this.clampPhotoOffset(this.photoOffsetX(), this.photoOffsetY(), value);
    if (corrected.x !== this.photoOffsetX() || corrected.y !== this.photoOffsetY()) {
      this.photoOffsetChange.emit(corrected);
    }
  }

  private clampPhotoOffset(x: number, y: number, scaleOverride?: number): PhotoOffset {
    const size = this.naturalSize();
    if (!size) return { x: 0, y: 0 };
    return clampPhotoOffset(size.w, size.h, this.canvasWidth(), this.canvasHeight(), scaleOverride ?? this.photoScale(), x, y);
  }

  onPhotoPointerDown(event: PointerEvent): void {
    if (!this.adjustingPhoto()) return;
    event.stopPropagation();
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    this.photoPanning = true;
    this.photoPanStartClient = { x: event.clientX, y: event.clientY };
    this.photoPanStartOffset = { x: this.photoOffsetX(), y: this.photoOffsetY() };
  }

  onPhotoPointerMove(event: PointerEvent): void {
    if (!this.photoPanning) return;
    event.stopPropagation();
    const rect = this.surface().nativeElement.getBoundingClientRect();
    const scaleX = this.canvasWidth() / rect.width;
    const scaleY = this.canvasHeight() / rect.height;
    const dx = (event.clientX - this.photoPanStartClient.x) * scaleX;
    const dy = (event.clientY - this.photoPanStartClient.y) * scaleY;
    const next = this.clampPhotoOffset(this.photoPanStartOffset.x + dx, this.photoPanStartOffset.y + dy);
    this.photoOffsetChange.emit(next);
  }

  onPhotoPointerUp(event: PointerEvent): void {
    if (!this.photoPanning) return;
    event.stopPropagation();
    this.photoPanning = false;
  }

  // --- Cell geometry -----------------------------------------------------------

  gemSrc(colourId: string): string {
    return getGemColourSwatch(colourId)?.gemSrc ?? '';
  }

  cellRect(row: number, col: number): CellRect {
    return {
      leftPct: col * this.cellWidthPct() + this.gemMarginXPct(),
      topPct: row * this.cellHeightPct() + this.gemMarginYPct(),
      widthPct: this.gemWidthPct(),
      heightPct: this.gemHeightPct(),
    };
  }

  /** The (grid-bounds-clamped) rectangle the current brush size would cover
   * if centered on (row, col) — same centering rule as
   * MosaicEditorStore.brushFootprint, so the hover outline always matches
   * exactly what a click would actually paint/erase. */
  brushRect(row: number, col: number): CellRect {
    const size = this.brushSize();
    const before = Math.floor((size - 1) / 2);
    const after = size - 1 - before;
    const { rows, cols } = this.gridDimensions();
    const rowStart = Math.max(0, row - before);
    const colStart = Math.max(0, col - before);
    const rowEnd = Math.min(rows - 1, row + after);
    const colEnd = Math.min(cols - 1, col + after);
    return {
      leftPct: colStart * this.cellWidthPct(),
      topPct: rowStart * this.cellHeightPct(),
      widthPct: (colEnd - colStart + 1) * this.cellWidthPct(),
      heightPct: (rowEnd - rowStart + 1) * this.cellHeightPct(),
    };
  }

  isFresh(cell: MosaicCell): boolean {
    return Date.now() - cell.createdAt < MOSAIC_GEM_FRESHNESS_WINDOW_MS;
  }

  /** Hiding the grid always fully hides it, regardless of the opacity slider
   * (which only controls intensity while it's shown) — placement/snapping is
   * unaffected either way, since that's driven by resolution, not this. */
  protected readonly effectiveGridOpacity = computed(() => (this.showGrid() ? this.gridOpacity() : 0));

  private readonly filledKeys = computed(() => new Set(this.cells().map((c) => `${c.row}:${c.col}`)));

  /** The translucent preview only makes sense over an empty cell — on a
   * filled one, the real gem is already showing. */
  protected readonly hoverPreviewVisible = computed(() => {
    const hover = this.hoverCell();
    return !!hover && !this.filledKeys().has(`${hover.row}:${hover.col}`) && this.tool() === 'paint';
  });

  // --- Pointer -> cell -----------------------------------------------------------

  private toCell(clientX: number, clientY: number): RowCol {
    const rect = this.surface().nativeElement.getBoundingClientRect();
    const { cols, rows } = this.gridDimensions();
    const col = Math.min(cols - 1, Math.max(0, Math.floor(((clientX - rect.left) / rect.width) * cols)));
    const row = Math.min(rows - 1, Math.max(0, Math.floor(((clientY - rect.top) / rect.height) * rows)));
    return { row, col };
  }

  /** Every cell on the straight line between two grid cells (inclusive of
   * `to`), so a fast drag never skips cells the pointer crossed between
   * two pointermove events. */
  private cellsBetween(from: RowCol, to: RowCol): RowCol[] {
    const dr = to.row - from.row;
    const dc = to.col - from.col;
    const steps = Math.max(Math.abs(dr), Math.abs(dc));
    if (steps === 0) return [to];
    const out: RowCol[] = [];
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      out.push({ row: Math.round(from.row + dr * t), col: Math.round(from.col + dc * t) });
    }
    return out;
  }

  // --- Keyboard: hold Space to pan (desktop) -------------------------------------

  @HostListener('window:keydown', ['$event'])
  onWindowKeydown(event: KeyboardEvent): void {
    if (event.code === 'Space' && !this.isTypingTarget(event.target)) {
      this.spaceHeld = true;
    }
  }

  @HostListener('window:keyup', ['$event'])
  onWindowKeyup(event: KeyboardEvent): void {
    if (event.code === 'Space') {
      this.spaceHeld = false;
    }
  }

  private isTypingTarget(target: EventTarget | null): boolean {
    const el = target as HTMLElement | null;
    return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);
  }

  /** Resets pan and zoom back to the default fitted view — the "Fit" button. */
  resetView(): void {
    this.panX.set(0);
    this.panY.set(0);
    this.zoomChange.emit(1);
  }

  // --- Wheel = zoom ---------------------------------------------------------------

  onWheel(event: WheelEvent): void {
    event.preventDefault();
    const delta = event.deltaY > 0 ? -0.15 : 0.15;
    const next = Math.min(MOSAIC_ZOOM_MAX, Math.max(MOSAIC_ZOOM_MIN, this.zoom() + delta * this.zoom()));
    this.zoomChange.emit(Math.round(next * 100) / 100);
  }

  // --- Pointer handling: paint/erase, single-pointer pan, two-finger pan/zoom ----

  onSurfacePointerDown(event: PointerEvent): void {
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    this.activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

    if (this.activePointers.size === 2) {
      this.strokeActive = false;
      this.beginPinch();
      return;
    }
    if (this.activePointers.size > 2) return;

    if (this.panMode() || this.spaceHeld) {
      this.panning.set(true);
      return;
    }

    this.strokeActive = true;
    this.lastPaintedCell = this.toCell(event.clientX, event.clientY);
    this.cellStrokeStart.emit();
    this.cellPaint.emit(this.lastPaintedCell);
  }

  onSurfacePointerMove(event: PointerEvent): void {
    if (this.activePointers.has(event.pointerId)) {
      this.activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    }

    if (this.activePointers.size >= 2) {
      this.updatePinch();
      return;
    }

    if (this.panning()) {
      this.panBy(event.movementX, event.movementY);
      return;
    }

    if (event.pointerType === 'mouse' && !this.adjustingPhoto()) {
      this.hoverCell.set(this.toCell(event.clientX, event.clientY));
    }

    if (!this.strokeActive) return;
    const cell = this.toCell(event.clientX, event.clientY);
    const from = this.lastPaintedCell ?? cell;
    for (const step of this.cellsBetween(from, cell)) {
      this.cellPaint.emit(step);
    }
    this.lastPaintedCell = cell;
  }

  onSurfacePointerUp(event: PointerEvent): void {
    this.activePointers.delete(event.pointerId);
    if (this.activePointers.size < 2) {
      this.gestureStartDistance = 0;
    }
    if (this.panning() && this.activePointers.size === 0) {
      this.panning.set(false);
    }
    if (this.strokeActive && this.activePointers.size === 0) {
      this.strokeActive = false;
      this.lastPaintedCell = null;
      this.cellStrokeEnd.emit();
    }
  }

  onSurfaceLeave(): void {
    this.hoverCell.set(null);
  }

  private beginPinch(): void {
    const points = Array.from(this.activePointers.values());
    const [a, b] = points;
    this.gestureStartDistance = Math.hypot(b.x - a.x, b.y - a.y);
    this.gestureStartZoom = this.zoom();
    this.gestureStartMid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    this.gestureStartPan = { x: this.panX(), y: this.panY() };
  }

  private updatePinch(): void {
    const points = Array.from(this.activePointers.values());
    if (points.length < 2 || this.gestureStartDistance === 0) return;
    const [a, b] = points;
    const distance = Math.hypot(b.x - a.x, b.y - a.y);
    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    const ratio = distance / this.gestureStartDistance;
    const nextZoom = Math.min(MOSAIC_ZOOM_MAX, Math.max(MOSAIC_ZOOM_MIN, this.gestureStartZoom * ratio));
    this.zoomChange.emit(Math.round(nextZoom * 100) / 100);
    this.panX.set(this.gestureStartPan.x + (mid.x - this.gestureStartMid.x));
    this.panY.set(this.gestureStartPan.y + (mid.y - this.gestureStartMid.y));
    this.clampPan();
  }

  private panBy(dx: number, dy: number): void {
    this.panX.update((v) => v + dx);
    this.panY.update((v) => v + dy);
    this.clampPan();
  }

  private clampPan(): void {
    const viewportRect = this.viewport().nativeElement.getBoundingClientRect();
    const zoom = this.zoom();
    const maxX = Math.max(0, (viewportRect.width * (zoom - 1)) / 2);
    const maxY = Math.max(0, (viewportRect.height * (zoom - 1)) / 2);
    this.panX.update((v) => Math.min(maxX, Math.max(-maxX, v)));
    this.panY.update((v) => Math.min(maxY, Math.max(-maxY, v)));
  }

  openFilePicker(event: Event): void {
    event.stopPropagation();
    this.fileInput().nativeElement.click();
  }

  /** Opens the file picker from outside (the toolbar's "Replace photo"
   * action, which sits outside the canvas frame) — same picker the in-canvas
   * upload prompt uses. */
  triggerUpload(): void {
    this.fileInput().nativeElement.click();
  }

  onFileChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) {
      this.photoFileSelected.emit(file);
    }
    input.value = '';
  }
}
