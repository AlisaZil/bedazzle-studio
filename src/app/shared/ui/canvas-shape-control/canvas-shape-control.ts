import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { CANVAS_SHAPE_PRESETS, CanvasShapeId } from '../../data/canvas-shape';

/** Square/Portrait/Landscape artboard picker, shared between the freehand
 * and mosaic editors. */
@Component({
  selector: 'app-canvas-shape-control',
  imports: [],
  templateUrl: './canvas-shape-control.html',
  styleUrl: './canvas-shape-control.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CanvasShapeControl {
  readonly value = input.required<CanvasShapeId>();

  readonly valueChange = output<CanvasShapeId>();

  protected readonly shapes = CANVAS_SHAPE_PRESETS;
}
