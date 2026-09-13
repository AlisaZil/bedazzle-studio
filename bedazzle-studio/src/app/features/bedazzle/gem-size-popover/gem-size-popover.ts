import { ChangeDetectionStrategy, Component, HostListener, input, output } from '@angular/core';
import { GemSizeControl } from '../gem-size-control/gem-size-control';

/**
 * Compact popover (opens directly above the toolbar's Size button) holding
 * the gem-size slider plus a small/large preview of the currently active
 * gem, so it's obvious what the slider is scaling. Replaces the size slider
 * that used to live permanently in the sidebar/gem library.
 */
@Component({
  selector: 'app-gem-size-popover',
  imports: [GemSizeControl],
  templateUrl: './gem-size-popover.html',
  styleUrl: './gem-size-popover.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GemSizePopover {
  readonly open = input(false);
  readonly previewSrc = input<string | null>(null);
  readonly value = input.required<number>();
  readonly min = input(40);
  readonly max = input(200);

  readonly valueInput = output<number>();
  readonly valueCommitted = output<number>();
  readonly closed = output<void>();

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.open()) {
      this.closed.emit();
    }
  }
}
