import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

export interface SegmentedSwitchOption {
  readonly value: string;
  readonly label: string;
}

/**
 * Generic N-option sliding pill switch — the same visual/interaction pattern
 * used for the top-level Freehand/Gem mosaic switch and for each editor's
 * Blank canvas/Photo background choice, so both share one implementation
 * instead of two copies of the same pill markup and CSS.
 */
@Component({
  selector: 'app-segmented-switch',
  imports: [],
  templateUrl: './segmented-switch.html',
  styleUrl: './segmented-switch.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SegmentedSwitch {
  readonly options = input.required<readonly SegmentedSwitchOption[]>();
  readonly value = input.required<string>();
  readonly ariaLabel = input('');

  readonly valueChange = output<string>();

  protected readonly activeIndex = computed(() => Math.max(0, this.options().findIndex((o) => o.value === this.value())));
}
