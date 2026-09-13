import { ChangeDetectionStrategy, Component, HostListener, input, output } from '@angular/core';

/**
 * Mobile slide-up bottom sheet chrome (backdrop, drag handle, header, and a
 * scrollable body). Content is projected in via `<ng-content>` so the same
 * chrome serves both the freehand gem library (`<app-gem-library>`, with its
 * "Use this gem" confirm button) and the mosaic panel (resolution/palette/
 * zoom, no confirm button needed since nothing there requires confirming).
 */
@Component({
  selector: 'app-gem-sheet',
  imports: [],
  templateUrl: './gem-sheet.html',
  styleUrl: './gem-sheet.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GemSheet {
  readonly open = input(false);
  readonly title = input('Your gem box');
  readonly showConfirm = input(true);
  readonly confirmLabel = input('Use this gem');

  readonly closed = output<void>();

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.open()) {
      this.closed.emit();
    }
  }
}
