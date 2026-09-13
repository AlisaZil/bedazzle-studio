import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

@Component({
  selector: 'app-zoom-controls',
  imports: [],
  templateUrl: './zoom-controls.html',
  styleUrl: './zoom-controls.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ZoomControls {
  readonly zoom = input.required<number>();
  readonly min = input(1);
  readonly max = input(6);
  readonly step = input(0.25);

  readonly zoomOut = output<void>();
  readonly zoomIn = output<void>();
  readonly reset = output<void>();

  protected percent(): number {
    return Math.round(this.zoom() * 100);
  }
}
