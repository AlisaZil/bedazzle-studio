import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { CanvasMode, MosaicTool } from '../data/mosaic-models';

@Component({
  selector: 'app-mosaic-toolbar',
  imports: [],
  templateUrl: './mosaic-toolbar.html',
  styleUrl: './mosaic-toolbar.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MosaicToolbar {
  readonly mode = input.required<CanvasMode>();
  readonly tool = input.required<MosaicTool>();
  readonly panMode = input(false);
  readonly canUndo = input(false);
  readonly canRestart = input(false);

  readonly replacePhoto = output<void>();
  readonly toolChange = output<MosaicTool>();
  readonly panModeToggle = output<void>();
  readonly undo = output<void>();
  readonly restart = output<void>();
  /** Opens the mobile panel (resolution/palette/zoom) — hidden on desktop,
   * where that panel is always visible as the side aside. */
  readonly openPanel = output<void>();
}
