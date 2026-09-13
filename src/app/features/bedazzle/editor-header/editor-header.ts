import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

export type SaveState = 'idle' | 'saving';

/**
 * Persistent top bar: title, a projected middle slot (the top-level
 * Freehand/Gem mosaic switch — projected rather than owned here so this
 * stays generic chrome, not tied to any one switch), and Save. Success is no
 * longer shown inline here — the SaveDialog modal confirms it instead, so
 * this only ever toggles between idle and saving.
 */
@Component({
  selector: 'app-editor-header',
  imports: [],
  templateUrl: './editor-header.html',
  styleUrl: './editor-header.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EditorHeader {
  readonly title = input('bedazzle studio');
  readonly saveState = input<SaveState>('idle');

  readonly save = output<void>();
}
