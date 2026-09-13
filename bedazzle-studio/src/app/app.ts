import { Component, inject, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { GEM_CATALOGUE } from './features/bedazzle/data/gem-catalogue';
import { GEM_COLOUR_CATALOGUE } from './features/mosaic/data/gem-colour-catalogue';
import { AppReadyState } from './shared/data/app-ready-state';
import { AppLoader } from './shared/ui/app-loader/app-loader';

const MIN_LOADER_DISPLAY_MS = 700;
const LOADER_FADE_MS = 280;

function preloadImage(src: string): Promise<void> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve();
    img.onerror = () => resolve(); // a missing/broken asset shouldn't stall the whole app
    img.src = new URL(src, document.baseURI).href;
  });
}

@Component({
  imports: [RouterOutlet, AppLoader],
  selector: 'app-root',
  styleUrl: './app.scss',
  templateUrl: './app.html',
})
export class App {
  private readonly appReady = inject(AppReadyState);

  protected readonly loaderVisible = signal(true);
  protected readonly loaderHiding = signal(false);
  protected readonly progress = signal(0);

  constructor() {
    void this.preloadGemArtwork();
  }

  private async preloadGemArtwork(): Promise<void> {
    const started = performance.now();
    const sources = [
      ...GEM_CATALOGUE.map((asset) => asset.src),
      ...GEM_COLOUR_CATALOGUE.flatMap((swatch) => [swatch.compartmentSrc, swatch.gemSrc]),
    ];
    const total = sources.length;
    let loaded = 0;

    await Promise.all(
      sources.map((src) =>
        preloadImage(src).then(() => {
          loaded += 1;
          this.progress.set(Math.round((loaded / total) * 100));
        }),
      ),
    );

    const elapsed = performance.now() - started;
    if (elapsed < MIN_LOADER_DISPLAY_MS) {
      await new Promise((resolve) => setTimeout(resolve, MIN_LOADER_DISPLAY_MS - elapsed));
    }

    // Start the loader's own fade and the editor's entrance reveal together
    // so they read as one continuous motion instead of two disjoint ones.
    this.loaderHiding.set(true);
    this.appReady.markReady();
    setTimeout(() => this.loaderVisible.set(false), LOADER_FADE_MS);
  }
}
