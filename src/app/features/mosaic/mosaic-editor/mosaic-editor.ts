import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { MosaicEditorStore } from '../data/mosaic-editor-store';
import { GEM_COLOUR_CATALOGUE } from '../data/gem-colour-catalogue';
import { CanvasMode, MosaicResolution } from '../data/mosaic-models';
import { MOSAIC_ZOOM_MAX, MOSAIC_ZOOM_MIN, MOSAIC_ZOOM_STEP } from '../data/mosaic.constants';
import { MosaicCanvas, RowCol } from '../mosaic-canvas/mosaic-canvas';
import { GridResolutionControl } from '../grid-resolution-control/grid-resolution-control';
import { GemColourBox } from '../gem-colour-box/gem-colour-box';
import { ZoomControls } from '../zoom-controls/zoom-controls';
import { MosaicToolbar } from '../mosaic-toolbar/mosaic-toolbar';
import { SegmentedSwitch, SegmentedSwitchOption } from '../../../shared/ui/segmented-switch/segmented-switch';
import { EditorHint } from '../../../shared/ui/editor-hint/editor-hint';
import { ConfirmDialog } from '../../../shared/ui/confirm-dialog/confirm-dialog';
import { CanvasShapeControl } from '../../../shared/ui/canvas-shape-control/canvas-shape-control';
import { CanvasShapeSelect } from '../../../shared/ui/canvas-shape-select/canvas-shape-select';
import { CanvasShapeId, getCanvasShape } from '../../../shared/data/canvas-shape';
import { PhotoSetupDialog, PhotoSetupResult } from '../../../shared/ui/photo-setup-dialog/photo-setup-dialog';
import { GemSheet } from '../../bedazzle/gem-sheet/gem-sheet';
import { GemSizeControl } from '../../bedazzle/gem-size-control/gem-size-control';

const BACKGROUND_OPTIONS: readonly SegmentedSwitchOption[] = [
  { value: 'blank', label: 'Blank canvas' },
  { value: 'photo', label: 'Photo' },
];

/**
 * Page-level coordinator for the gem-mosaic editor — the mosaic counterpart
 * to BedazzleEditor/EditorStore. Owns no artwork itself (that's
 * MosaicEditorStore) but wires the presentational grid/palette/toolbar
 * pieces to it and holds purely-visual state: which confirmation dialog (if
 * any) is showing, and the view-only zoom level (not undo/export relevant,
 * so it isn't part of the store). Save itself is a shared header action
 * owned by the outer BedazzleEditor shell (see its `onSave`), since one Save
 * button/state-machine serves whichever editing mode is currently active.
 */
@Component({
  selector: 'app-mosaic-editor',
  imports: [
    NgTemplateOutlet,
    MosaicCanvas,
    GridResolutionControl,
    GemColourBox,
    ZoomControls,
    MosaicToolbar,
    SegmentedSwitch,
    EditorHint,
    ConfirmDialog,
    CanvasShapeControl,
    CanvasShapeSelect,
    PhotoSetupDialog,
    GemSheet,
    GemSizeControl,
  ],
  templateUrl: './mosaic-editor.html',
  styleUrl: './mosaic-editor.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MosaicEditor {
  /** Set by BedazzleEditor when the mobile Start screen's own Mosaic path
   * already resolved the Blank-canvas/Photo choice, so the first-entry
   * "Mosaic settings" sheet below doesn't ask that same question again. */
  readonly skipInitialSettings = input(false);

  protected readonly store = inject(MosaicEditorStore);

  protected readonly catalogue = GEM_COLOUR_CATALOGUE;
  protected readonly backgroundOptions = BACKGROUND_OPTIONS;
  protected readonly zoomMin = MOSAIC_ZOOM_MIN;
  protected readonly zoomMax = MOSAIC_ZOOM_MAX;

  /** Matches shared/styles/breakpoints.scss's $desktop: 900px — computed
   * once, same as BedazzleEditor's equivalent flag. */
  private readonly isDesktopViewport = typeof window !== 'undefined' && window.matchMedia('(min-width: 900px)').matches;

  protected readonly shapeRatio = computed(() => getCanvasShape(this.store.canvasShapeId()).ratio);
  protected readonly gridOpacityPercent = computed(() => Math.round(this.store.gridOpacity() * 100));

  protected readonly zoom = signal(1);
  protected readonly panMode = signal(false);
  protected readonly pendingResolution = signal<MosaicResolution | null>(null);
  protected readonly pendingCanvasShape = signal<CanvasShapeId | null>(null);
  protected readonly pendingPhotoUrl = signal<string | null>(null);
  protected readonly photoSetupOpen = signal(false);
  protected readonly showRestartConfirm = signal(false);
  protected readonly mobilePanelOpen = signal(false);
  protected readonly moreSheetOpen = signal(false);

  /** Mobile-only "settings first" gate: shown on first entry into an empty
   * mosaic so switching modes never suddenly reveals a live paintable grid
   * with no explanation. Never reappears once the user paints something or
   * dismisses it (any dismissal path — Generate mosaic or closing the sheet
   * — resolves it), and is simply always-resolved on desktop. */
  private readonly settingsConfirmed = signal(this.isDesktopViewport);
  protected readonly showMosaicSettings = computed(() => !this.settingsConfirmed() && this.store.cellCount() === 0);

  constructor() {
    // An effect rather than a constructor-time read: signal inputs bound
    // from the parent aren't guaranteed resolved before the constructor
    // body runs, but an effect always sees the current value once it is.
    effect(() => {
      if (this.skipInitialSettings()) {
        this.settingsConfirmed.set(true);
      }
    });
  }

  /** Mirrors MosaicCanvas's internal "moving the photo" flag, purely so the
   * hint strip (owned here, not by the canvas) can pick the right copy. */
  protected readonly adjustingPhoto = signal(false);

  protected readonly hintText = computed(() => {
    if (this.store.mode() === 'photo') {
      if (!this.store.photoUrl()) return 'Upload a photo, then pick a colour and click a square.';
      if (this.adjustingPhoto()) return 'Drag the photo to reposition it.';
    }
    return 'Pick a colour, then click a square.';
  });

  onBackgroundModeChange(mode: string): void {
    this.store.setMode(mode as CanvasMode);
  }

  onPhotoFileSelected(file: File): void {
    this.pendingPhotoUrl.set(URL.createObjectURL(file));
    this.photoSetupOpen.set(true);
  }

  onPhotoSetupConfirmed(result: PhotoSetupResult): void {
    const url = this.pendingPhotoUrl();
    if (url) {
      this.store.setPhotoUrl(url);
      this.store.setPhotoOffset(result.offsetX, result.offsetY);
      this.store.setPhotoScale(result.scale);
    }
    this.pendingPhotoUrl.set(null);
    this.photoSetupOpen.set(false);
  }

  onPhotoSetupCancelled(): void {
    const url = this.pendingPhotoUrl();
    if (url) {
      URL.revokeObjectURL(url);
    }
    this.pendingPhotoUrl.set(null);
    this.photoSetupOpen.set(false);
  }

  onResolutionRequested(next: MosaicResolution): void {
    if (next === this.store.resolution()) return;
    if (this.store.cellCount() === 0) {
      this.store.changeResolution(next);
      return;
    }
    this.pendingResolution.set(next);
  }

  onConfirmResolutionChange(): void {
    const next = this.pendingResolution();
    if (next) {
      this.store.changeResolution(next);
    }
    this.pendingResolution.set(null);
  }

  onCancelResolutionChange(): void {
    this.pendingResolution.set(null);
  }

  onCanvasShapeRequested(next: string): void {
    const shapeId = next as CanvasShapeId;
    if (shapeId === this.store.canvasShapeId()) return;
    if (this.store.cellCount() === 0) {
      this.store.changeCanvasShape(shapeId);
      return;
    }
    this.pendingCanvasShape.set(shapeId);
  }

  onConfirmCanvasShapeChange(): void {
    const next = this.pendingCanvasShape();
    if (next) {
      this.store.changeCanvasShape(next);
    }
    this.pendingCanvasShape.set(null);
  }

  onCancelCanvasShapeChange(): void {
    this.pendingCanvasShape.set(null);
  }

  onCellStrokeStart(): void {
    this.store.beginStroke();
  }

  onCellPaint(cell: RowCol): void {
    this.store.applyToolAt(cell.row, cell.col);
  }

  onCellStrokeEnd(): void {
    this.store.endStroke();
  }

  /** The slider works in whole percent (0-100) for a nicer step size; the
   * store keeps the underlying 0-1 opacity fraction. */
  onGridOpacityInput(percent: number): void {
    this.store.setGridOpacity(percent / 100);
  }

  onZoomChange(next: number): void {
    this.zoom.set(Math.round(Math.min(MOSAIC_ZOOM_MAX, Math.max(MOSAIC_ZOOM_MIN, next)) * 100) / 100);
  }

  onZoomOut(): void {
    this.onZoomChange(this.zoom() - MOSAIC_ZOOM_STEP);
  }

  onZoomIn(): void {
    this.onZoomChange(this.zoom() + MOSAIC_ZOOM_STEP);
  }

  onZoomReset(): void {
    this.zoom.set(1);
  }

  onTogglePan(): void {
    this.panMode.update((v) => !v);
  }

  onOpenMore(): void {
    this.moreSheetOpen.set(true);
  }

  onCloseMore(): void {
    this.moreSheetOpen.set(false);
  }

  /** "Generate mosaic" and dismissing the settings sheet any other way
   * (backdrop/X) both just reveal the canvas — there's nothing destructive
   * about closing it either way since nothing's been painted yet. */
  onResolveMosaicSettings(): void {
    this.settingsConfirmed.set(true);
  }

  onRestartClick(): void {
    if (this.store.canRestart()) {
      this.showRestartConfirm.set(true);
    }
  }

  onRestartConfirm(): void {
    this.store.restart();
    this.showRestartConfirm.set(false);
  }

  onRestartCancel(): void {
    this.showRestartConfirm.set(false);
  }
}
