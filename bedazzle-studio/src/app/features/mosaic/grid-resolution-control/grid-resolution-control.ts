import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { MosaicResolution } from '../data/mosaic-models';
import { MOSAIC_RESOLUTIONS } from '../data/mosaic.constants';
import { computeGridDimensions } from '../../../shared/data/canvas-shape';

@Component({
  selector: 'app-grid-resolution-control',
  imports: [],
  templateUrl: './grid-resolution-control.html',
  styleUrl: './grid-resolution-control.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GridResolutionControl {
  readonly value = input.required<MosaicResolution>();
  /** Canvas shape's width/height ratio — each option's actual column/row
   * counts (and the caption) are derived from this, so they always match
   * what the grid would really look like at the current canvas shape. */
  readonly shapeRatio = input.required<number>();

  readonly valueChange = output<MosaicResolution>();

  protected readonly resolutions = MOSAIC_RESOLUTIONS;

  dimensionsFor(resolution: MosaicResolution): { cols: number; rows: number } {
    return computeGridDimensions(this.shapeRatio(), resolution);
  }
}
