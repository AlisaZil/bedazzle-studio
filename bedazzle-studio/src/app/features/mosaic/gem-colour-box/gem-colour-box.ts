import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { GemColourSwatch } from '../data/mosaic-models';
import { GemColourCompartment } from '../gem-colour-compartment/gem-colour-compartment';

/** The 5x5 organiser-box palette, plus a "Selected: <name>" caption. */
@Component({
  selector: 'app-gem-colour-box',
  imports: [GemColourCompartment],
  templateUrl: './gem-colour-box.html',
  styleUrl: './gem-colour-box.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GemColourBox {
  readonly swatches = input.required<readonly GemColourSwatch[]>();
  readonly selectedId = input.required<string>();

  readonly colourChange = output<string>();

  protected readonly selectedSwatch = computed(() => this.swatches().find((s) => s.id === this.selectedId()));
}
