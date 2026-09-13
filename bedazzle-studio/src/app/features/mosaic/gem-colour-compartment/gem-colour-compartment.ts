import { ChangeDetectionStrategy, Component, effect, input, output, signal } from '@angular/core';
import { GemColourSwatch } from '../data/mosaic-models';

/** One organiser-box compartment tile in the mosaic colour palette. */
@Component({
  selector: 'app-gem-colour-compartment',
  imports: [],
  templateUrl: './gem-colour-compartment.html',
  styleUrl: './gem-colour-compartment.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GemColourCompartment {
  readonly swatch = input.required<GemColourSwatch>();
  readonly selected = input(false);

  readonly picked = output<void>();

  /** Brief pop when this compartment (specifically) just became selected. */
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
