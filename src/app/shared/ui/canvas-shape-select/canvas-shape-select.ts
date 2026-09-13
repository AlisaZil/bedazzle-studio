import { ChangeDetectionStrategy, Component, ElementRef, computed, inject, input, output, signal } from '@angular/core';
import { CANVAS_SHAPE_PRESETS, CanvasShapeId, getCanvasShape } from '../../data/canvas-shape';

/**
 * Custom Square/Portrait/Landscape dropdown — a pill trigger (current shape's
 * icon + label + chevron) that opens a floating menu of options, each with
 * its own shape icon and a checkmark on the selected one. A plain native
 * `<select>` can't be styled this precisely (per-option icons, checkmark,
 * custom menu chrome), which is why this exists instead of one.
 */
@Component({
  selector: 'app-canvas-shape-select',
  imports: [],
  templateUrl: './canvas-shape-select.html',
  styleUrl: './canvas-shape-select.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '(document:pointerdown)': 'onDocumentPointerDown($event)',
    '(document:keydown.escape)': 'close()',
  },
})
export class CanvasShapeSelect {
  readonly value = input.required<CanvasShapeId>();

  readonly valueChange = output<CanvasShapeId>();

  private readonly elementRef = inject(ElementRef<HTMLElement>);

  protected readonly shapes = CANVAS_SHAPE_PRESETS;
  protected readonly open = signal(false);
  protected readonly selected = computed(() => getCanvasShape(this.value()));

  toggle(): void {
    this.open.update((v) => !v);
  }

  close(): void {
    this.open.set(false);
  }

  select(shapeId: CanvasShapeId): void {
    this.valueChange.emit(shapeId);
    this.close();
  }

  onDocumentPointerDown(event: PointerEvent): void {
    if (!this.open()) return;
    if (!this.elementRef.nativeElement.contains(event.target as Node)) {
      this.close();
    }
  }
}
