# Bedazzle Studio

A browser-based gem/rhinestone design tool. Upload a photo (or start from a
blank canvas), decorate it with gems, and export the result as a PNG. Built
with Angular 22 (standalone components, signals) and Vite.

## Editing modes

The app has two independent editing modes, switchable from the header, each
with its own artwork and undo history:

- **Freehand** — pick a gem from the library and place/drag/resize it
  anywhere on the canvas at any size, gem-by-gem.
- **Gem mosaic** — paint gems onto a fixed grid (16×16 to 64×64) from a
  25-colour organiser-style palette, like a cross-stitch/pixel-art canvas.
  Supports Paint/Eraser tools with adjustable brush size, Pan, and a
  Random-fill tool.

Shared across both modes:
- Blank canvas or photo background, with a dedicated "position your photo"
  step (pan/zoom/crop) after every upload, and an on-canvas "Move & resize"
  toggle to reposition it later.
- Square / portrait / landscape canvas shapes.
- Undo/redo history, restart-with-confirmation, and PNG export/share.
- A responsive layout with distinct desktop (side panel) and mobile (bottom
  sheet) presentations.

## Project layout

```
src/app/
  features/
    bedazzle/   # Freehand editor: canvas, gem library, toolbar, and its
                # editor store/data layer (gem catalogue, PNG export, etc.)
    mosaic/     # Gem mosaic editor: grid canvas, colour palette, toolbar,
                # and its own editor store/data layer
  shared/
    ui/         # Reusable presentational components (dialogs, switches,
                # canvas-shape picker, photo setup dialog, ...)
    data/       # Cross-feature helpers (canvas shape/aspect-ratio math,
                # photo pan/zoom math, PNG delivery, app-ready state)
    styles/     # Design tokens, breakpoints, shared animations

public/
  gems/         # Freehand gem sprite assets
  mosaic/       # Mosaic palette compartment/gem sprite assets
```

Each editing mode keeps its state in its own signal-based store
(`EditorStore` for Freehand, `MosaicEditorStore` for Gem mosaic) so the two
modes never affect each other's artwork or undo stack.

## Development server

To start a local development server, run:

```bash
npm start
```

Once the server is running, open your browser and navigate to
`http://localhost:4200/`. The application will automatically reload whenever
you modify any of the source files.

## Building

To build the project, run:

```bash
npm run build
```

This compiles the project and stores the build artifacts in the `dist/`
directory. By default, the production build optimizes the application for
performance and speed.

## Running unit tests

To execute unit tests with the [Vitest](https://vitest.dev/) test runner, use:

```bash
npm test
```

## Additional resources

For more on the Angular CLI, see the
[Angular CLI Overview and Command Reference](https://angular.dev/tools/cli).
