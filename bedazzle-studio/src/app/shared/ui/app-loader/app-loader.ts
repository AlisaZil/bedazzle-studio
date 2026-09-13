import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * Full-screen splash shown while the app boots and the gem artwork
 * preloads. Purely presentational — `App` owns the actual loading state and
 * toggles a `.hide` class on this component's host to fade it out.
 */
@Component({
  selector: 'app-loader',
  imports: [],
  templateUrl: './app-loader.html',
  styleUrl: './app-loader.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppLoader {
  readonly progress = input(0);
}
