import { ChangeDetectionStrategy, Component, ElementRef, computed, effect, input, output, signal, viewChild } from '@angular/core';
import { CanvasShapeId, computeCanvasDimensions, getCanvasShape } from '../../data/canvas-shape';
import { clampPhotoOffset, computePhotoBox } from '../../data/photo-transform';
import { CanvasShapeSelect } from '../canvas-shape-select/canvas-shape-select';
import { CanvasShapeControl } from '../canvas-shape-control/canvas-shape-control';

export interface PhotoSetupResult {
  readonly offsetX: number;
  readonly offsetY: number;
  readonly scale: number;
}

interface Point {
  readonly x: number;
  readonly y: number;
}

/** Reference long side for this dialog's own pan/zoom maths. The resulting
 * offset/scale are handed straight to whichever editor's store confirms
 * them, so this must match that store's own logical long side — both
 * EditorStore's CANVAS_LOGICAL_SIZE and MosaicEditorStore's
 * MOSAIC_CANVAS_LOGICAL_SIZE are 1000, so this stays in sync with both. */
const DIALOG_LOGICAL_SIZE = 1000;

const ZOOM_STEP = 0.1;

/**
 * Full-screen "position your photo" step shown once, right after a photo is
 * uploaded/replaced — before it ever reaches the editor's own canvas. Owns
 * its own local pan/zoom state (reset every time it opens with a new photo)
 * and only reports a result via `confirmed` when the user hits "Use photo";
 * `cancelled` discards the pending upload entirely. The canvas shape can
 * also be changed here (via `canvasShapeRequested`), reusing whichever
 * confirm-gated handler the host page already has for that.
 *
 * Positioning after this step (the on-canvas "Move & resize" chip) is a
 * separate, already-existing flow this component knows nothing about.
 */
@Component({
  selector: 'app-photo-setup-dialog',
  imports: [CanvasShapeSelect, CanvasShapeControl],
  templateUrl: './photo-setup-dialog.html',
  styleUrl: './photo-setup-dialog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PhotoSetupDialog {
  readonly open = input(false);
  readonly photoUrl = input<string | null>(null);
  readonly canvasShapeId = input.required<CanvasShapeId>();
  readonly zoomMin = input(1);
  readonly zoomMax = input(2.5);

  readonly canvasShapeRequested = output<CanvasShapeId>();
  readonly confirmed = output<PhotoSetupResult>();
  readonly cancelled = output<void>();

  private readonly dialogRef = viewChild.required<ElementRef<HTMLDialogElement>>('dialogEl');
  private readonly surface = viewChild.required<ElementRef<HTMLDivElement>>('surface');

  protected readonly naturalSize = signal<{ w: number; h: number } | null>(null);
  protected readonly offsetX = signal(0);
  protected readonly offsetY = signal(0);
  protected readonly scale = signal(1);

  private panning = false;
  private panStartClient: Point = { x: 0, y: 0 };
  private panStartOffset: Point = { x: 0, y: 0 };
  private decodeToken = 0;

  protected readonly shapeRatio = computed(() => getCanvasShape(this.canvasShapeId()).ratio);
  protected readonly canvasWidth = computed(() => computeCanvasDimensions(this.shapeRatio(), DIALOG_LOGICAL_SIZE).width);
  protected readonly canvasHeight = computed(() => computeCanvasDimensions(this.shapeRatio(), DIALOG_LOGICAL_SIZE).height);

  protected readonly photoBox = computed(() => {
    const size = this.naturalSize();
    if (!size) return null;
    return computePhotoBox(size.w, size.h, this.canvasWidth(), this.canvasHeight(), this.offsetX(), this.offsetY(), this.scale());
  });

  protected readonly photoLeftPct = computed(() => ((this.photoBox()?.left ?? 0) / this.canvasWidth()) * 100);
  protected readonly photoTopPct = computed(() => ((this.photoBox()?.top ?? 0) / this.canvasHeight()) * 100);
  protected readonly photoWidthPct = computed(() => ((this.photoBox()?.width ?? this.canvasWidth()) / this.canvasWidth()) * 100);
  protected readonly photoHeightPct = computed(() => ((this.photoBox()?.height ?? this.canvasHeight()) / this.canvasHeight()) * 100);

  protected readonly zoomPercent = computed(() => Math.round(this.scale() * 100));

  constructor() {
    effect(() => {
      const dialog = this.dialogRef().nativeElement;
      if (this.open() && !dialog.open) {
        dialog.showModal();
      } else if (!this.open() && dialog.open) {
        dialog.close();
      }
    });

    effect(() => {
      const isOpen = this.open();
      const url = this.photoUrl();
      const token = ++this.decodeToken;
      if (!isOpen || !url) {
        this.naturalSize.set(null);
        return;
      }
      // A fresh photo always starts centered and unzoomed, regardless of
      // whatever was left over from a previous time this dialog was open.
      this.offsetX.set(0);
      this.offsetY.set(0);
      this.scale.set(1);
      const img = new Image();
      img.src = url;
      img
        .decode()
        .then(() => {
          if (token === this.decodeToken) {
            this.naturalSize.set({ w: img.naturalWidth, h: img.naturalHeight });
          }
        })
        .catch(() => {
          // Leave the placeholder box in place.
        });
    });
  }

  private clampOffset(x: number, y: number, scaleOverride?: number): Point {
    const size = this.naturalSize();
    if (!size) return { x: 0, y: 0 };
    return clampPhotoOffset(size.w, size.h, this.canvasWidth(), this.canvasHeight(), scaleOverride ?? this.scale(), x, y);
  }

  private setScale(value: number): void {
    const clamped = Math.min(this.zoomMax(), Math.max(this.zoomMin(), value));
    this.scale.set(clamped);
    const corrected = this.clampOffset(this.offsetX(), this.offsetY(), clamped);
    this.offsetX.set(corrected.x);
    this.offsetY.set(corrected.y);
  }

  onScaleInput(event: Event): void {
    this.setScale(Number((event.target as HTMLInputElement).value));
  }

  onZoomOut(): void {
    this.setScale(this.scale() - ZOOM_STEP);
  }

  onZoomIn(): void {
    this.setScale(this.scale() + ZOOM_STEP);
  }

  onReset(): void {
    this.offsetX.set(0);
    this.offsetY.set(0);
    this.scale.set(1);
  }

  onPointerDown(event: PointerEvent): void {
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    this.panning = true;
    this.panStartClient = { x: event.clientX, y: event.clientY };
    this.panStartOffset = { x: this.offsetX(), y: this.offsetY() };
  }

  onPointerMove(event: PointerEvent): void {
    if (!this.panning) return;
    const rect = this.surface().nativeElement.getBoundingClientRect();
    const scaleX = this.canvasWidth() / rect.width;
    const scaleY = this.canvasHeight() / rect.height;
    const dx = (event.clientX - this.panStartClient.x) * scaleX;
    const dy = (event.clientY - this.panStartClient.y) * scaleY;
    const next = this.clampOffset(this.panStartOffset.x + dx, this.panStartOffset.y + dy);
    this.offsetX.set(next.x);
    this.offsetY.set(next.y);
  }

  onPointerUp(): void {
    this.panning = false;
  }

  onCancel(): void {
    this.cancelled.emit();
  }

  onUsePhoto(): void {
    this.confirmed.emit({ offsetX: this.offsetX(), offsetY: this.offsetY(), scale: this.scale() });
  }

  /** Native dialog also closes on Escape — keep state in sync (same as
   * ConfirmDialog's cancel-on-close pattern). */
  onDialogClose(): void {
    if (this.open()) {
      this.cancelled.emit();
    }
  }
}
