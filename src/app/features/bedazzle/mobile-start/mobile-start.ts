import { ChangeDetectionStrategy, Component, ElementRef, computed, output, signal, viewChild } from '@angular/core';
import type { EditorMode } from '../bedazzle-editor/bedazzle-editor';

interface ModeCopy {
  readonly icon: string;
  readonly title: string;
  readonly description: string;
}

const MODE_COPY: Record<EditorMode, ModeCopy> = {
  freehand: {
    icon: '💎',
    title: 'Freehand',
    description: 'Place gems anywhere you like — drag, resize, and arrange them freely.',
  },
  mosaic: {
    icon: '🔳',
    title: 'Gem mosaic',
    description: 'Fill a grid over your photo automatically, one gem per square.',
  },
};

/**
 * Mobile-only pre-editor screen: a plain fixed-position full-screen block
 * (not a native <dialog> — it's mounted/unmounted via the parent's `@if`
 * rather than toggled, and there's no "cancel" concept here, just a choice)
 * shown before `BedazzleEditor.editorStarted` flips true.
 *
 * Two steps, slid between with a CSS transform transition (no router/
 * animations module involved): first pick Freehand vs. Gem mosaic, then —
 * once that choice is visible at the top as a short explanation — pick a
 * Blank canvas or a photo. The actual photo upload/positioning reuses the
 * existing PhotoSetupDialog pipeline via `photoFileSelected`, wired by the
 * parent exactly like the in-editor replace-photo flow; this component only
 * ever captures the two choices and hands them both up together.
 */
@Component({
  selector: 'app-mobile-start',
  imports: [],
  templateUrl: './mobile-start.html',
  styleUrl: './mobile-start.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MobileStart {
  readonly chooseBlank = output<EditorMode>();
  readonly photoFileSelected = output<{ file: File; mode: EditorMode }>();

  private readonly fileInput = viewChild.required<ElementRef<HTMLInputElement>>('fileInput');

  protected readonly step = signal<1 | 2>(1);
  protected readonly selectedMode = signal<EditorMode>('freehand');
  protected readonly modeCopy = computed(() => MODE_COPY[this.selectedMode()]);

  onPickMode(mode: EditorMode): void {
    this.selectedMode.set(mode);
    this.step.set(2);
  }

  onBack(): void {
    this.step.set(1);
  }

  openFilePicker(): void {
    this.fileInput().nativeElement.click();
  }

  onFileChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) {
      this.photoFileSelected.emit({ file, mode: this.selectedMode() });
    }
    input.value = '';
  }

  onChooseBlank(): void {
    this.chooseBlank.emit(this.selectedMode());
  }
}
