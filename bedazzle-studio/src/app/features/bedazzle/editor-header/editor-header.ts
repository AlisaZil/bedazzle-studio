import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

export type SaveState = 'idle' | 'saving' | 'success';

/**
 * Persistent top bar: title, a projected middle slot (the top-level
 * Freehand/Gem mosaic switch — projected rather than owned here so this
 * stays generic chrome, not tied to any one switch), and Save.
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
  /** Shown next to the checkmark once saveState is 'success', e.g. "Ready", "Shared". */
  readonly saveMessage = input('Ready');

  readonly save = output<void>();
}
