import { ChangeDetectionStrategy, Component, HostListener, computed, effect, inject, signal } from '@angular/core';
import { GEM_CATEGORIES, GEM_CATALOGUE } from '../data/gem-catalogue';
import { EditorStore } from '../data/editor-store';
import { PngExport } from '../data/png-export';
import { GEM_EXIT_MS, RESTART_EXIT_MS, SAVE_SUCCESS_MS } from '../data/editor.constants';
import { CanvasMode } from '../data/editor-models';
import { AppReadyState } from '../../../shared/data/app-ready-state';
import { EditorHeader, SaveState } from '../editor-header/editor-header';
import { DesignCanvas, GemDragTo, LogicalPoint } from '../design-canvas/design-canvas';
import { EditorToolbar } from '../editor-toolbar/editor-toolbar';
import { GemLibrary } from '../gem-library/gem-library';
import { GemSheet } from '../gem-sheet/gem-sheet';
import { SelectedGemControls } from '../selected-gem-controls/selected-gem-controls';
import { ConfirmDialog } from '../../../shared/ui/confirm-dialog/confirm-dialog';
import { EditorHint } from '../../../shared/ui/editor-hint/editor-hint';
import { SegmentedSwitch, SegmentedSwitchOption } from '../../../shared/ui/segmented-switch/segmented-switch';
import { CanvasShapeControl } from '../../../shared/ui/canvas-shape-control/canvas-shape-control';
import { CanvasShapeSelect } from '../../../shared/ui/canvas-shape-select/canvas-shape-select';
import { CanvasShapeId } from '../../../shared/data/canvas-shape';
import { PhotoSetupDialog, PhotoSetupResult } from '../../../shared/ui/photo-setup-dialog/photo-setup-dialog';
import { MosaicEditor } from '../../mosaic/mosaic-editor/mosaic-editor';
import { MosaicEditorStore } from '../../mosaic/data/mosaic-editor-store';
import { MosaicExport } from '../../mosaic/data/mosaic-export';

export type EditorMode = 'freehand' | 'mosaic';

const EDITOR_MODE_OPTIONS: readonly SegmentedSwitchOption[] = [
  { value: 'freehand', label: 'Freehand' },
  { value: 'mosaic', label: 'Gem mosaic' },
];

const BACKGROUND_OPTIONS: readonly SegmentedSwitchOption[] = [
  { value: 'blank', label: 'Blank canvas' },
  { value: 'photo', label: 'Photo' },
];

/**
 * Top-level shell: hosts the persistent header (title, Freehand/Gem mosaic
 * switch, Save) and — since each editing mode keeps its own fully
 * independent artwork/undo history (MosaicEditorStore never touches
 * EditorStore or vice versa) — shows exactly one of the two editors at a
 * time. Save is a single shared action here because it's one button/state
 * machine in the header regardless of which mode is active; it just
 * delegates to whichever store/exporter pair matches the current mode.
 *
 * The freehand editor's own layout/logic stays directly in this component
 * (unchanged from before mosaic mode existed) rather than being extracted
 * into a sibling component, specifically so its entrance-reveal styling
 * (`:host(.revealed) .editor__canvas-region` etc.) keeps working exactly as
 * it did — extracting it would move that markup behind a child component's
 * view encapsulation boundary, out of reach of a `:host`-scoped selector.
 */
@Component({
  selector: 'app-bedazzle-editor',
  imports: [
    EditorHeader,
    DesignCanvas,
    EditorToolbar,
    GemLibrary,
    GemSheet,
    SelectedGemControls,
    ConfirmDialog,
    EditorHint,
    SegmentedSwitch,
    CanvasShapeControl,
    CanvasShapeSelect,
    PhotoSetupDialog,
    MosaicEditor,
  ],
  templateUrl: './bedazzle-editor.html',
  styleUrl: './bedazzle-editor.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class.revealed]': 'revealed()',
  },
})
export class BedazzleEditor {
  protected readonly store = inject(EditorStore);
  private readonly pngExport = inject(PngExport);
  private readonly appReady = inject(AppReadyState);
  protected readonly mosaicStore = inject(MosaicEditorStore);
  private readonly mosaicExport = inject(MosaicExport);

  protected readonly categories = GEM_CATEGORIES;
  protected readonly catalogue = GEM_CATALOGUE;
  protected readonly editorModeOptions = EDITOR_MODE_OPTIONS;
  protected readonly backgroundOptions = BACKGROUND_OPTIONS;

  protected readonly editorMode = signal<EditorMode>('freehand');
  protected readonly gemSheetOpen = signal(false);
  protected readonly showRestartConfirm = signal(false);
  protected readonly pendingCanvasShape = signal<CanvasShapeId | null>(null);
  protected readonly pendingPhotoUrl = signal<string | null>(null);
  protected readonly photoSetupOpen = signal(false);
  protected readonly sizePopoverOpen = signal(false);
  protected readonly saveState = signal<SaveState>('idle');
  protected readonly saveMessage = signal('Ready');
  protected readonly exportError = signal<string | null>(null);

  /** Gems fading out after Delete/Undo/Restart, kept rendered (inert) until
   * the animation finishes and the real store mutation actually removes them. */
  protected readonly exitingGemIds = signal<ReadonlySet<string>>(new Set());

  /** Plays the page's one-off entrance reveal once the root loader starts
   * hiding — not on this component's own (earlier, unrelated) construction. */
  protected readonly revealed = signal(false);

  /** Mirrors DesignCanvas's internal "moving the photo" flag, purely so the
   * hint strip (owned here, not by the canvas) can pick the right copy. */
  protected readonly adjustingPhoto = signal(false);

  private resizeGestureActive = false;

  protected readonly hintText = computed(() => {
    if (this.store.mode() === 'photo') {
      if (!this.store.photoUrl()) return 'Upload a photo, then pick a gem and tap to place it.';
      if (this.adjustingPhoto()) return 'Drag the photo to reposition it.';
    }
    if (this.store.randomMode()) return 'Tap anywhere to place a random gem.';
    if (this.store.gems().length === 0) return 'Pick a gem. Tap to place.';
    return 'Tap a gem to select it, or an empty spot to place another.';
  });

  protected readonly sizePreviewSrc = computed(() => this.catalogue.find((asset) => asset.id === this.store.activeAssetId())?.src ?? null);

  constructor() {
    effect(() => {
      if (this.appReady.ready()) {
        this.revealed.set(true);
      }
    });
  }

  onEditorModeChange(mode: string): void {
    this.editorMode.set(mode as EditorMode);
  }

  onModeChange(mode: string): void {
    this.store.setMode(mode as CanvasMode);
  }

  onCanvasShapeRequested(next: string): void {
    const shapeId = next as CanvasShapeId;
    if (shapeId === this.store.canvasShapeId()) return;
    if (this.store.gems().length === 0) {
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

  onOpenSizePopover(): void {
    this.sizePopoverOpen.update((v) => !v);
  }

  onCloseSizePopover(): void {
    this.sizePopoverOpen.set(false);
  }

  onPlaceAt(point: LogicalPoint): void {
    this.store.placeGem(point.x, point.y);
  }

  onSelectGem(id: string): void {
    this.store.selectGem(id);
  }

  onGemDragStart(): void {
    this.store.beginDrag();
  }

  onGemDragTo(payload: GemDragTo): void {
    this.store.updateDragPosition(payload.id, payload.x, payload.y);
  }

  onGemDragEnd(): void {
    this.store.endDrag();
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

  onSelectedSizeInput(size: number): void {
    if (!this.resizeGestureActive) {
      this.store.beginResize();
      this.resizeGestureActive = true;
    }
    this.store.updateSelectedSize(size);
  }

  onSelectedSizeCommitted(size: number): void {
    this.store.updateSelectedSize(size);
    this.store.endResize();
    this.resizeGestureActive = false;
  }

  onOpenGems(): void {
    this.gemSheetOpen.set(true);
  }

  onCloseGemSheet(): void {
    this.gemSheetOpen.set(false);
  }

  onRestartClick(): void {
    if (this.store.canRestart()) {
      this.showRestartConfirm.set(true);
    }
  }

  onRestartConfirm(): void {
    this.showRestartConfirm.set(false);
    const ids = this.store.gems().map((gem) => gem.id);
    if (ids.length === 0) {
      this.store.restart();
      return;
    }
    this.markExiting(ids);
    setTimeout(() => {
      this.store.restart();
      this.clearExiting(ids);
    }, RESTART_EXIT_MS);
  }

  onRestartCancel(): void {
    this.showRestartConfirm.set(false);
  }

  /** Fades the selected gem out, then actually removes it once the
   * animation finishes. Selection clears immediately so its controls
   * (handle, side panel) disappear right away rather than fading with it. */
  onDeleteSelected(): void {
    const id = this.store.selectedGemId();
    if (!id) return;
    this.store.selectGem(null);
    this.markExiting([id]);
    setTimeout(() => {
      this.store.deleteGemById(id);
      this.clearExiting([id]);
    }, GEM_EXIT_MS);
  }

  /** Undo itself is instant in the store, but if it's about to remove gems
   * (undoing a placement/duplicate/random-batch) we fade those out first so
   * the removal doesn't just cut. Undoing a delete/restart instead restores
   * gems — those play their own plain "fade-in" entrance (see PlacedGem). */
  onUndo(): void {
    const target = this.store.peekUndo();
    if (!target) return;

    const currentIds = new Set(this.store.gems().map((gem) => gem.id));
    const targetIds = new Set(target.map((gem) => gem.id));
    const removedIds = [...currentIds].filter((id) => !targetIds.has(id));

    if (removedIds.length === 0) {
      this.store.undo();
      return;
    }

    this.markExiting(removedIds);
    setTimeout(() => {
      this.store.undo();
      this.clearExiting(removedIds);
    }, GEM_EXIT_MS);
  }

  private markExiting(ids: readonly string[]): void {
    this.exitingGemIds.update((current) => {
      const next = new Set(current);
      ids.forEach((id) => next.add(id));
      return next;
    });
  }

  private clearExiting(ids: readonly string[]): void {
    this.exitingGemIds.update((current) => {
      const next = new Set(current);
      ids.forEach((id) => next.delete(id));
      return next;
    });
  }

  async onSave(): Promise<void> {
    if (this.saveState() === 'saving') return;
    this.exportError.set(null);
    this.saveState.set('saving');
    try {
      const outcome =
        this.editorMode() === 'mosaic'
          ? await this.mosaicExport.exportPng({
              backgroundColor: this.mosaicStore.backgroundColor(),
              canvasShapeId: this.mosaicStore.canvasShapeId(),
              photoUrl: this.mosaicStore.photoUrl(),
              photoOffsetX: this.mosaicStore.photoOffsetX(),
              photoOffsetY: this.mosaicStore.photoOffsetY(),
              photoScale: this.mosaicStore.photoScale(),
              resolution: this.mosaicStore.resolution(),
              cells: this.mosaicStore.cells(),
            })
          : await this.pngExport.exportPng({
              backgroundColor: this.store.backgroundColor(),
              canvasShapeId: this.store.canvasShapeId(),
              photoUrl: this.store.photoUrl(),
              photoOffsetX: this.store.photoOffsetX(),
              photoOffsetY: this.store.photoOffsetY(),
              photoScale: this.store.photoScale(),
              gems: this.store.gems(),
            });
      this.saveMessage.set(outcome === 'shared' ? 'Shared' : outcome === 'previewed' ? 'Preview ready' : 'Ready');
      this.saveState.set('success');
      setTimeout(() => {
        if (this.saveState() === 'success') {
          this.saveState.set('idle');
        }
      }, SAVE_SUCCESS_MS);
    } catch (error) {
      this.exportError.set(
        error instanceof Error ? error.message : `Could not export your ${this.editorMode() === 'mosaic' ? 'mosaic' : 'design'}.`,
      );
      this.saveState.set('idle');
    }
  }

  @HostListener('document:keydown', ['$event'])
  onKeydown(event: KeyboardEvent): void {
    const target = event.target as HTMLElement | null;
    const isFormField =
      !!target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);
    if (isFormField) return;

    if (this.editorMode() === 'mosaic') {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        this.mosaicStore.undo();
      }
      return;
    }

    if ((event.key === 'Delete' || event.key === 'Backspace') && this.store.selectedGemId()) {
      event.preventDefault();
      this.onDeleteSelected();
      return;
    }

    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
      event.preventDefault();
      this.onUndo();
    }
  }
}
