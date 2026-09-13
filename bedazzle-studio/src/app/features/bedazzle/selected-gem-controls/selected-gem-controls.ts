import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { GemSizeControl } from '../gem-size-control/gem-size-control';

/**
 * Controls for the currently-selected placed gem: resize, duplicate, delete.
 * Distinct from the library's size control, which only sets the size used
 * for the *next* gem placed — this one mutates the selected gem in place.
 */
@Component({
  selector: 'app-selected-gem-controls',
  imports: [GemSizeControl],
  templateUrl: './selected-gem-controls.html',
  styleUrl: './selected-gem-controls.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SelectedGemControls {
  readonly assetSrc = input.required<string>();
  readonly assetLabel = input.required<string>();
  readonly size = input.required<number>();
  readonly sizeMin = input(40);
  readonly sizeMax = input(200);

  readonly sizeInput = output<number>();
  readonly sizeCommitted = output<number>();
  readonly duplicate = output<void>();
  readonly delete = output<void>();
}
