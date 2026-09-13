import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * Centred instruction strip shown below the canvas, above the toolbar —
 * shared between the freehand and mosaic editors so their helper copy
 * ("Pick a gem, tap to place", "Drag the photo to reposition it", "Pick a
 * colour, then click a square"...) all lives in one place, one look.
 */
@Component({
  selector: 'app-editor-hint',
  imports: [],
  templateUrl: './editor-hint.html',
  styleUrl: './editor-hint.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EditorHint {
  readonly text = input.required<string>();
}
