import { GemColourSwatch } from './mosaic-models';

/**
 * 25 gem colours sliced from the supplied organiser-box reference sheets
 * (gem-squares-transparent.png for compartments, gems-colors.png for the
 * matching individual gems — see /photos in the repo root). Both sheets are
 * arranged in the same 5x5 row/column order, sliced 1:1 by position, so
 * index N here always pairs the right compartment with the right gem.
 * Files live in public/mosaic/{compartments,gems}/<id>.png.
 */
export const GEM_COLOUR_CATALOGUE: readonly GemColourSwatch[] = [
  // Row 1 — neutrals & metals
  { id: 'silver', label: 'Silver', compartmentSrc: 'mosaic/compartments/silver.png', gemSrc: 'mosaic/gems/silver.png' },
  { id: 'gold', label: 'Gold', compartmentSrc: 'mosaic/compartments/gold.png', gemSrc: 'mosaic/gems/gold.png' },
  { id: 'bronze', label: 'Bronze', compartmentSrc: 'mosaic/compartments/bronze.png', gemSrc: 'mosaic/gems/bronze.png' },
  { id: 'black', label: 'Black', compartmentSrc: 'mosaic/compartments/black.png', gemSrc: 'mosaic/gems/black.png' },
  { id: 'pearl-white', label: 'Pearl White', compartmentSrc: 'mosaic/compartments/pearl-white.png', gemSrc: 'mosaic/gems/pearl-white.png' },

  // Row 2 — purples & blues
  { id: 'lavender', label: 'Lavender', compartmentSrc: 'mosaic/compartments/lavender.png', gemSrc: 'mosaic/gems/lavender.png' },
  { id: 'deep-purple', label: 'Deep Purple', compartmentSrc: 'mosaic/compartments/deep-purple.png', gemSrc: 'mosaic/gems/deep-purple.png' },
  { id: 'ice-blue', label: 'Ice Blue', compartmentSrc: 'mosaic/compartments/ice-blue.png', gemSrc: 'mosaic/gems/ice-blue.png' },
  { id: 'royal-blue', label: 'Royal Blue', compartmentSrc: 'mosaic/compartments/royal-blue.png', gemSrc: 'mosaic/gems/royal-blue.png' },
  { id: 'teal', label: 'Teal', compartmentSrc: 'mosaic/compartments/teal.png', gemSrc: 'mosaic/gems/teal.png' },

  // Row 3 — greens
  { id: 'mint-green', label: 'Mint Green', compartmentSrc: 'mosaic/compartments/mint-green.png', gemSrc: 'mosaic/gems/mint-green.png' },
  { id: 'aqua', label: 'Aqua', compartmentSrc: 'mosaic/compartments/aqua.png', gemSrc: 'mosaic/gems/aqua.png' },
  { id: 'lime', label: 'Lime', compartmentSrc: 'mosaic/compartments/lime.png', gemSrc: 'mosaic/gems/lime.png' },
  { id: 'emerald', label: 'Emerald', compartmentSrc: 'mosaic/compartments/emerald.png', gemSrc: 'mosaic/gems/emerald.png' },
  { id: 'forest-green', label: 'Forest Green', compartmentSrc: 'mosaic/compartments/forest-green.png', gemSrc: 'mosaic/gems/forest-green.png' },

  // Row 4 — yellows & oranges
  { id: 'cream-yellow', label: 'Cream Yellow', compartmentSrc: 'mosaic/compartments/cream-yellow.png', gemSrc: 'mosaic/gems/cream-yellow.png' },
  { id: 'bright-yellow', label: 'Bright Yellow', compartmentSrc: 'mosaic/compartments/bright-yellow.png', gemSrc: 'mosaic/gems/bright-yellow.png' },
  { id: 'peach', label: 'Peach', compartmentSrc: 'mosaic/compartments/peach.png', gemSrc: 'mosaic/gems/peach.png' },
  { id: 'orange', label: 'Orange', compartmentSrc: 'mosaic/compartments/orange.png', gemSrc: 'mosaic/gems/orange.png' },
  { id: 'coral', label: 'Coral', compartmentSrc: 'mosaic/compartments/coral.png', gemSrc: 'mosaic/gems/coral.png' },

  // Row 5 — pinks & reds
  { id: 'blush-pink', label: 'Blush Pink', compartmentSrc: 'mosaic/compartments/blush-pink.png', gemSrc: 'mosaic/gems/blush-pink.png' },
  { id: 'rose-pink', label: 'Rose Pink', compartmentSrc: 'mosaic/compartments/rose-pink.png', gemSrc: 'mosaic/gems/rose-pink.png' },
  { id: 'magenta', label: 'Magenta', compartmentSrc: 'mosaic/compartments/magenta.png', gemSrc: 'mosaic/gems/magenta.png' },
  { id: 'red', label: 'Red', compartmentSrc: 'mosaic/compartments/red.png', gemSrc: 'mosaic/gems/red.png' },
  { id: 'ruby-red', label: 'Ruby Red', compartmentSrc: 'mosaic/compartments/ruby-red.png', gemSrc: 'mosaic/gems/ruby-red.png' },
];

export function getGemColourSwatch(id: string): GemColourSwatch | undefined {
  return GEM_COLOUR_CATALOGUE.find((swatch) => swatch.id === id);
}
