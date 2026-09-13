import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

/**
 * Reusable size slider. Emits `valueInput` live while dragging (for
 * responsive visual feedback) and `valueCommitted` once the gesture ends, so
 * callers that feed an undo history can collapse a whole drag into one step.
 */
@Component({
  selector: 'app-gem-size-control',
  imports: [],
  templateUrl: './gem-size-control.html',
  styleUrl: './gem-size-control.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GemSizeControl {
  readonly label = input('Gem size');
  readonly value = input.required<number>();
  readonly min = input(40);
  readonly max = input(200);
  readonly step = input(1);
  /** Swaps the trailing decorative icon for a numeric readout (e.g. "35%") —
   * used where the raw value is meaningful to show, like grid opacity. */
  readonly showValue = input(false);
  readonly valueSuffix = input('%');

  readonly valueInput = output<number>();
  readonly valueCommitted = output<number>();

  onInput(event: Event): void {
    const value = Number((event.target as HTMLInputElement).value);
    this.valueInput.emit(value);
  }

  onCommit(event: Event): void {
    const value = Number((event.target as HTMLInputElement).value);
    this.valueCommitted.emit(value);
  }
}
