import { ChangeDetectionStrategy, Component, ElementRef, effect, input, output, signal, viewChild } from '@angular/core';
import { canShareBlob, downloadBlob, shareBlob } from '../../data/png-delivery';

/**
 * Shown once a PNG has been rendered (see EditorStore.renderPng /
 * MosaicEditorStore's mosaic equivalent) — built on the native <dialog>
 * element, same pattern as ConfirmDialog. Download and Share are both real,
 * explicit actions on the same already-rendered blob (replacing the old
 * single auto-picked "deliver" step), so the user actually chooses.
 */
@Component({
  selector: 'app-save-dialog',
  imports: [],
  templateUrl: './save-dialog.html',
  styleUrl: './save-dialog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SaveDialog {
  readonly open = input(false);
  readonly blob = input<Blob | null>(null);
  readonly fileName = input('bedazzle-design.png');
  readonly title = input('Your sparkle masterpiece is ready');

  readonly createAnother = output<void>();
  readonly closed = output<void>();

  private readonly dialogRef = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');

  protected readonly canShare = canShareBlob();
  protected readonly sharing = signal(false);
  protected readonly shareError = signal<string | null>(null);

  constructor() {
    effect(() => {
      const dialog = this.dialogRef().nativeElement;
      if (this.open() && !dialog.open) {
        this.shareError.set(null);
        dialog.showModal();
      } else if (!this.open() && dialog.open) {
        dialog.close();
      }
    });
  }

  onDownload(): void {
    const blob = this.blob();
    if (!blob) return;
    downloadBlob(blob, this.fileName());
  }

  async onShare(): Promise<void> {
    const blob = this.blob();
    if (!blob || this.sharing()) return;
    this.sharing.set(true);
    this.shareError.set(null);
    try {
      await shareBlob(blob, this.fileName());
    } catch {
      this.shareError.set('Could not share the file. Try downloading it instead.');
    } finally {
      this.sharing.set(false);
    }
  }

  onCreateAnother(): void {
    this.createAnother.emit();
  }

  onClose(): void {
    this.closed.emit();
  }

  /** Native dialog also closes on Escape / backdrop click — keep state in sync. */
  onDialogClose(): void {
    if (this.open()) {
      this.closed.emit();
    }
  }
}
