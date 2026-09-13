import { ChangeDetectionStrategy, Component, effect, input, output, signal } from '@angular/core';
import { GemAsset } from '../data/editor-models';

/** A single selectable tile in the gem library grid. */
@Component({
  selector: 'app-gem-picker-item',
  imports: [],
  templateUrl: './gem-picker-item.html',
  styleUrl: './gem-picker-item.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GemPickerItem {
  readonly asset = input.required<GemAsset>();
  readonly selected = input(false);

  readonly picked = output<void>();

  /** Plays the brief select-pop only on the tile that just became selected —
   * each tile only reacts to its own `selected` input, never its neighbours'. */
  protected readonly popping = signal(false);

  constructor() {
    effect(() => {
      if (this.selected()) {
        this.popping.set(true);
      }
    });
  }

  onPopAnimationEnd(): void {
    this.popping.set(false);
  }
}
