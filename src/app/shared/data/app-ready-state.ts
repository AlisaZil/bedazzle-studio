import { Service, signal } from '@angular/core';

/**
 * Tiny cross-tree signal so the (lazy-loaded) editor page can time its
 * one-off entrance reveal to when the root loader starts fading out,
 * instead of to its own — earlier and unrelated — construction moment.
 */
@Service()
export class AppReadyState {
  private readonly _ready = signal(false);
  readonly ready = this._ready.asReadonly();

  markReady(): void {
    this._ready.set(true);
  }
}
