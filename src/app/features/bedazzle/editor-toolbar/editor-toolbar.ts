import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { CanvasMode } from '../data/editor-models';
import { GemSizePopover } from '../gem-size-popover/gem-size-popover';

/**
 * Primary editor actions, shared verbatim between the desktop and mobile
 * layouts: Gems (mobile only — the sidebar is always visible on desktop),
 * Replace photo (photo mode only), Size (opens a popover attached to this
 * same button), Random (a toggleable tool — stays highlighted while active;
 * every canvas tap places a random gem instead of the library's selection),
 * Undo, Restart.
 */
@Component({
  selector: 'app-editor-toolbar',
  imports: [GemSizePopover],
  templateUrl: './editor-toolbar.html',
  styleUrl: './editor-toolbar.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EditorToolbar {
  readonly mode = input.required<CanvasMode>();
  readonly canUndo = input(false);
  readonly canRestart = input(false);

  readonly sizePopoverOpen = input(false);
  readonly gemSize = input(90);
  readonly sizeMin = input(40);
  readonly sizeMax = input(200);
  readonly sizePreviewSrc = input<string | null>(null);
  readonly randomMode = input(false);

  readonly openGems = output<void>();
  readonly replacePhoto = output<void>();
  readonly openSize = output<void>();
  readonly closeSize = output<void>();
  readonly sizeInput = output<number>();
  readonly sizeCommitted = output<number>();
  readonly randomModeToggle = output<void>();
  readonly undo = output<void>();
  readonly restart = output<void>();
  /** Opens the mobile-only "More" sheet (Replace photo/Duplicate/Delete/
   * Restart) — on desktop those stay as direct buttons here, so this button
   * itself is mobile-only (see .toolbar__btn--more in the stylesheet). */
  readonly openMore = output<void>();
}
