import { ChangeDetectionStrategy, Component, ElementRef, computed, inject, input, output, signal } from '@angular/core';
import { GEM_FRESHNESS_WINDOW_MS } from '../data/editor.constants';
import { PlacedGemView } from '../data/editor-models';

export interface PointerPoint {
  readonly clientX: number;
  readonly clientY: number;
  readonly pointerId: number;
}

export type GemEntranceKind = 'pop' | 'fade';

/**
 * One gem sitting on the canvas. Positioned with percentages of the logical
 * canvas size, so it scales automatically with the canvas's rendered size —
 * no pixel math needed here. Drag geometry (converting pointer movement into
 * logical units) is delegated to the parent canvas, which knows the current
 * on-screen scale; this component only reports raw pointer coordinates, and
 * applies them straight to its position with no transition, so it tracks the
 * pointer with zero lag.
 *
 * Entrance animation: a gem mounts either with a celebratory "pop" (a genuine
 * new placement/duplicate/random gem) or a plain "fade" (one restored by
 * undo). This is decided once, the first time it's read, by comparing the
 * gem's `createdAt` against now — see `entranceKind()`. It's intentionally
 * *not* a reactive `computed()`: re-deriving it later (e.g. because the gem
 * moved) would compare an old `createdAt` against a much-later "now" and
 * flip a long-since-placed gem over to "fade" mid-animation.
 *
 * When selected, a corner resize handle (desktop/mouse only — see the
 * `bp.$desktop` guard in the stylesheet) lets you resize in place by
 * dragging, in addition to the size slider in the side panel. Because this
 * component already renders at its own logical size, it can work out the
 * on-screen px-per-logical-unit scale from its own bounding box, so the
 * resize math is entirely self-contained.
 */
@Component({
  selector: 'app-placed-gem',
  imports: [],
  templateUrl: './placed-gem.html',
  styleUrl: './placed-gem.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '(pointerdown)': 'onPointerDown($event)',
    '(pointermove)': 'onPointerMove($event)',
    '(pointerup)': 'onPointerUp($event)',
    '(pointercancel)': 'onPointerUp($event)',
    '(keydown.enter)': 'activated.emit()',
    '(keydown.space)': 'activated.emit()',
    '[class.selected]': 'selected()',
    '[class.dragging]': 'dragging()',
    '[class.exiting]': 'exiting()',
    '[class.pop]': 'entranceKind() === "pop"',
    '[class.fade-in]': 'entranceKind() === "fade"',
    '[style.left.%]': 'leftPct()',
    '[style.top.%]': 'topPct()',
    '[style.width.%]': 'widthPct()',
    '[style.height.%]': 'heightPct()',
    '[attr.aria-label]': 'gem().asset.label',
    '[attr.aria-pressed]': 'selected()',
    role: 'button',
    tabindex: '0',
  },
})
export class PlacedGem {
  private readonly elementRef = inject(ElementRef<HTMLElement>);

  readonly gem = input.required<PlacedGemView>();
  readonly canvasWidth = input.required<number>();
  readonly canvasHeight = input.required<number>();
  readonly selected = input(false);
  /** Set by the page while a delete/undo/restart fade-out is playing, just
   * before the gem is actually removed from state. */
  readonly exiting = input(false);

  readonly activated = output<void>();
  readonly dragStart = output<PointerPoint>();
  readonly dragMove = output<PointerPoint>();
  readonly dragEnd = output<void>();
  readonly resizeInput = output<number>();
  readonly resizeCommitted = output<number>();

  readonly dragging = signal(false);
  private resizing = false;
  private resizeStartClient = { x: 0, y: 0 };
  private resizeStartSize = 0;
  private resizePxPerUnit = 1;

  readonly leftPct = computed(() => ((this.gem().x - this.gem().width / 2) / this.canvasWidth()) * 100);
  readonly topPct = computed(() => ((this.gem().y - this.gem().height / 2) / this.canvasHeight()) * 100);
  readonly widthPct = computed(() => (this.gem().width / this.canvasWidth()) * 100);
  readonly heightPct = computed(() => (this.gem().height / this.canvasHeight()) * 100);

  private cachedEntranceKind: GemEntranceKind | null = null;

  /** Memoized on first read (see class doc) — deliberately not a computed(). */
  entranceKind(): GemEntranceKind {
    if (!this.cachedEntranceKind) {
      const age = Date.now() - this.gem().createdAt;
      this.cachedEntranceKind = age < GEM_FRESHNESS_WINDOW_MS ? 'pop' : 'fade';
    }
    return this.cachedEntranceKind;
  }

  onPointerDown(event: PointerEvent): void {
    event.stopPropagation();
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    this.dragging.set(true);
    this.activated.emit();
    this.dragStart.emit({ clientX: event.clientX, clientY: event.clientY, pointerId: event.pointerId });
  }

  onPointerMove(event: PointerEvent): void {
    if (!this.dragging()) return;
    event.stopPropagation();
    this.dragMove.emit({ clientX: event.clientX, clientY: event.clientY, pointerId: event.pointerId });
  }

  onPointerUp(event: PointerEvent): void {
    if (!this.dragging()) return;
    event.stopPropagation();
    this.dragging.set(false);
    this.dragEnd.emit();
  }

  onHandlePointerDown(event: PointerEvent): void {
    event.stopPropagation();
    event.preventDefault();
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    this.resizing = true;
    this.resizeStartClient = { x: event.clientX, y: event.clientY };
    this.resizeStartSize = this.gem().size;

    const rect = this.elementRef.nativeElement.getBoundingClientRect();
    const longerSidePx = this.gem().asset.aspect >= 1 ? rect.width : rect.height;
    this.resizePxPerUnit = longerSidePx / this.resizeStartSize;
  }

  onHandlePointerMove(event: PointerEvent): void {
    if (!this.resizing) return;
    event.stopPropagation();
    this.resizeInput.emit(this.nextSize(event));
  }

  onHandlePointerUp(event: PointerEvent): void {
    if (!this.resizing) return;
    event.stopPropagation();
    this.resizing = false;
    this.resizeCommitted.emit(this.nextSize(event));
  }

  /** Dragging the bottom-right handle away from the gem grows it; toward it shrinks it. */
  private nextSize(event: PointerEvent): number {
    const dx = event.clientX - this.resizeStartClient.x;
    const dy = event.clientY - this.resizeStartClient.y;
    const deltaPx = (dx + dy) / 2;
    return this.resizeStartSize + deltaPx / this.resizePxPerUnit;
  }
}
