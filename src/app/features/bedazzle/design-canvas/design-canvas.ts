import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  effect,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { CanvasMode, PlacedGemView } from '../data/editor-models';
import { PlacedGem, PointerPoint } from '../placed-gem/placed-gem';
import { GemSizeControl } from '../gem-size-control/gem-size-control';
import { clampPhotoOffset, computePhotoBox } from '../../../shared/data/photo-transform';

export interface LogicalPoint {
  readonly x: number;
  readonly y: number;
}

export interface GemDragTo extends LogicalPoint {
  readonly id: string;
}

const EMPTY_ID_SET: ReadonlySet<string> = new Set();

/**
 * The bedazzling surface: background (colour or photo) plus every placed
 * gem. Purely presentational — all coordinate math (client px -> logical
 * canvas units) lives here since this is the one place that knows the
 * canvas's current on-screen size, but no editor state is stored or mutated
 * directly; everything is reported upward via outputs. The one exception is
 * `adjustingPhoto`: purely a local interaction-mode flag (is the user
 * currently repositioning/zooming the photo), not artwork, so it lives here
 * rather than in the store.
 */
@Component({
  selector: 'app-design-canvas',
  imports: [PlacedGem, GemSizeControl],
  templateUrl: './design-canvas.html',
  styleUrl: './design-canvas.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DesignCanvas {
  readonly mode = input.required<CanvasMode>();
  readonly backgroundColor = input.required<string>();
  readonly canvasWidth = input.required<number>();
  readonly canvasHeight = input.required<number>();
  readonly photoUrl = input<string | null>(null);
  readonly photoOffsetX = input(0);
  readonly photoOffsetY = input(0);
  readonly photoScale = input(1);
  readonly photoZoomMin = input(1);
  readonly photoZoomMax = input(2.5);
  readonly gems = input.required<readonly PlacedGemView[]>();
  readonly selectedGemId = input<string | null>(null);
  /** Gems mid fade-out (delete/undo/restart) — still rendered, but inert. */
  readonly exitingGemIds = input<ReadonlySet<string>>(EMPTY_ID_SET);

  readonly placeAt = output<LogicalPoint>();
  readonly selectGem = output<string>();
  readonly gemDragStart = output<string>();
  readonly gemDragTo = output<GemDragTo>();
  readonly gemDragEnd = output<void>();
  readonly gemResizeInput = output<number>();
  readonly gemResizeCommitted = output<number>();
  readonly photoFileSelected = output<File>();
  readonly photoOffsetChange = output<LogicalPoint>();
  readonly photoScaleChange = output<number>();
  /** Mirrors `adjustingPhoto` outward, purely so the page can pick the right
   * hint-strip copy — the flag itself still lives here since it's a local
   * interaction mode, not artwork. */
  readonly adjustingPhotoChange = output<boolean>();

  private readonly surface = viewChild.required<ElementRef<HTMLDivElement>>('surface');
  private readonly fileInput = viewChild.required<ElementRef<HTMLInputElement>>('fileInput');

  private draggingId: string | null = null;
  private dragStartClient: LogicalPoint = { x: 0, y: 0 };
  private dragStartLogical: LogicalPoint = { x: 0, y: 0 };

  /** The photo actually shown — only updated once a newly-set photoUrl has
   * finished decoding, so the crossfade never reveals a half-decoded image
   * and the previous photo/background stays put until the new one is ready. */
  protected readonly displayedPhotoUrl = signal<string | null>(null);
  protected readonly naturalSize = signal<{ w: number; h: number } | null>(null);
  /** Move/resize mode for the photo — initial positioning happens in the
   * upload-time PhotoSetupDialog instead, so this starts off and is only
   * toggled afterwards via the "Move & resize" chip, for repositioning later. */
  protected readonly adjustingPhoto = signal(false);
  private decodeToken = 0;

  private panning = false;
  private panStartClient: LogicalPoint = { x: 0, y: 0 };
  private panStartOffset: LogicalPoint = { x: 0, y: 0 };

  /** The photo's on-screen box, in the same 0-1000 logical units as gems —
   * computed once from the decoded image's natural size plus the current
   * pan/zoom, and used identically for CSS percentages here and for the
   * pixel maths in PngExport, so display and export always match. */
  protected readonly aspectRatio = computed(() => this.canvasWidth() / this.canvasHeight());

  /** The photo's on-screen box, in the same logical units as gems — computed
   * once from the decoded image's natural size plus the current pan/zoom,
   * via the same shared maths PngExport uses, so display and export always
   * match. */
  protected readonly photoBox = computed(() => {
    const size = this.naturalSize();
    if (!size) return null;
    return computePhotoBox(size.w, size.h, this.canvasWidth(), this.canvasHeight(), this.photoOffsetX(), this.photoOffsetY(), this.photoScale());
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
        .catch(() => {
          // Leave whatever was previously displayed in place.
        });
    });
  }

  private toLogical(clientX: number, clientY: number): LogicalPoint {
    const rect = this.surface().nativeElement.getBoundingClientRect();
    return {
      x: ((clientX - rect.left) / rect.width) * this.canvasWidth(),
      y: ((clientY - rect.top) / rect.height) * this.canvasHeight(),
    };
  }

  onSurfacePointerDown(event: PointerEvent): void {
    this.placeAt.emit(this.toLogical(event.clientX, event.clientY));
  }

  onGemActivated(gemId: string): void {
    this.selectGem.emit(gemId);
  }

  onGemDragStart(gem: PlacedGemView, point: PointerPoint): void {
    this.draggingId = gem.id;
    this.dragStartClient = { x: point.clientX, y: point.clientY };
    this.dragStartLogical = { x: gem.x, y: gem.y };
    this.gemDragStart.emit(gem.id);
  }

  onGemDragMove(point: PointerPoint): void {
    if (!this.draggingId) return;
    const rect = this.surface().nativeElement.getBoundingClientRect();
    const scaleX = this.canvasWidth() / rect.width;
    const scaleY = this.canvasHeight() / rect.height;
    const dx = (point.clientX - this.dragStartClient.x) * scaleX;
    const dy = (point.clientY - this.dragStartClient.y) * scaleY;
    this.gemDragTo.emit({ id: this.draggingId, x: this.dragStartLogical.x + dx, y: this.dragStartLogical.y + dy });
  }

  onGemDragEndInternal(): void {
    if (!this.draggingId) return;
    this.draggingId = null;
    this.gemDragEnd.emit();
  }

  openFilePicker(event: Event): void {
    event.stopPropagation();
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

  toggleAdjustPhoto(event: Event): void {
    event.stopPropagation();
    this.adjustingPhoto.update((value) => !value);
    this.adjustingPhotoChange.emit(this.adjustingPhoto());
  }

  /** Opens the file picker from outside (the toolbar's "Replace photo"
   * action) — same picker the in-canvas upload prompt uses. */
  triggerUpload(): void {
    this.fileInput().nativeElement.click();
  }

  onZoomInput(value: number): void {
    this.photoScaleChange.emit(value);
    // Zooming out can leave the current pan revealing empty space (the
    // allowed range shrinks with the new scale) — pull it back in if so.
    const corrected = this.clampOffset(this.photoOffsetX(), this.photoOffsetY(), value);
    if (corrected.x !== this.photoOffsetX() || corrected.y !== this.photoOffsetY()) {
      this.photoOffsetChange.emit(corrected);
    }
  }

  /** Clamps the pan so the photo can never reveal empty space at its edges. */
  private clampOffset(x: number, y: number, scaleOverride?: number): LogicalPoint {
    const size = this.naturalSize();
    if (!size) return { x: 0, y: 0 };
    return clampPhotoOffset(size.w, size.h, this.canvasWidth(), this.canvasHeight(), scaleOverride ?? this.photoScale(), x, y);
  }

  onPhotoPointerDown(event: PointerEvent): void {
    if (!this.adjustingPhoto()) return;
    event.stopPropagation();
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    this.panning = true;
    this.panStartClient = { x: event.clientX, y: event.clientY };
    this.panStartOffset = { x: this.photoOffsetX(), y: this.photoOffsetY() };
  }

  onPhotoPointerMove(event: PointerEvent): void {
    if (!this.panning) return;
    event.stopPropagation();
    const rect = this.surface().nativeElement.getBoundingClientRect();
    const scaleX = this.canvasWidth() / rect.width;
    const scaleY = this.canvasHeight() / rect.height;
    const dx = (event.clientX - this.panStartClient.x) * scaleX;
    const dy = (event.clientY - this.panStartClient.y) * scaleY;
    const next = this.clampOffset(this.panStartOffset.x + dx, this.panStartOffset.y + dy);
    this.photoOffsetChange.emit(next);
  }

  onPhotoPointerUp(event: PointerEvent): void {
    if (!this.panning) return;
    event.stopPropagation();
    this.panning = false;
  }
}
