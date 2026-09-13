import { GemAsset, GemCategory } from './editor-models';

/**
 * Curated gem catalogue, sliced from the supplied `gems-transparent.png` sprite
 * sheet (see /photos in the repo root for the source sheet). Files live in
 * public/gems/ and are served at /gems/<file>.png.
 */
export const GEM_CATEGORIES: readonly GemCategory[] = [
  { id: 'all', label: 'All' },
  { id: 'hearts', label: 'Hearts' },
  { id: 'stars', label: 'Stars' },
  { id: 'classic', label: 'Classic' },
  { id: 'flowers', label: 'Flowers' },
];

export const GEM_CATALOGUE: readonly GemAsset[] = [
  { id: 'heart-blue', label: 'Blue Heart', category: 'hearts', src: 'gems/heart-blue.png', aspect: 1.045 },
  { id: 'heart-red', label: 'Red Heart', category: 'hearts', src: 'gems/heart-red.png', aspect: 1.059 },
  { id: 'heart-pink', label: 'Pink Heart', category: 'hearts', src: 'gems/heart-pink.png', aspect: 1.034 },
  { id: 'heart-purple', label: 'Purple Heart', category: 'hearts', src: 'gems/heart-purple.png', aspect: 1.074 },

  { id: 'star-gold', label: 'Gold Star', category: 'stars', src: 'gems/star-gold.png', aspect: 0.985 },
  { id: 'star-red', label: 'Red Star', category: 'stars', src: 'gems/star-red.png', aspect: 0.961 },
  { id: 'star-green', label: 'Green Star', category: 'stars', src: 'gems/star-green.png', aspect: 0.935 },
  { id: 'star-teal', label: 'Teal Star', category: 'stars', src: 'gems/star-teal.png', aspect: 0.965 },

  { id: 'round-diamond', label: 'Clear Diamond', category: 'classic', src: 'gems/round-diamond.png', aspect: 1.011 },
  { id: 'round-gold', label: 'Gold Round', category: 'classic', src: 'gems/round-gold.png', aspect: 1.02 },
  { id: 'round-magenta', label: 'Magenta Round', category: 'classic', src: 'gems/round-magenta.png', aspect: 1.056 },
  { id: 'oval-purple', label: 'Purple Oval', category: 'classic', src: 'gems/oval-purple.png', aspect: 0.984 },
  { id: 'round-teal', label: 'Round Teal', category: 'classic', src: 'gems/round-teal.png', aspect: 1.038 },
  { id: 'emerald-pink', label: 'Pink Emerald-cut', category: 'classic', src: 'gems/emerald-pink.png', aspect: 1.026 },
  { id: 'emerald-green', label: 'Green Emerald-cut', category: 'classic', src: 'gems/emerald-green.png', aspect: 0.897 },
  { id: 'diamond-purple', label: 'Purple Diamond-cut', category: 'classic', src: 'gems/diamond-purple.png', aspect: 1.13 },
  { id: 'drop-orange', label: 'Orange Drop', category: 'classic', src: 'gems/drop-orange.png', aspect: 0.814 },

  { id: 'flower-red', label: 'Red Flower', category: 'flowers', src: 'gems/flower-red.png', aspect: 1.051 },
  { id: 'flower-pink', label: 'Pink Flower', category: 'flowers', src: 'gems/flower-pink.png', aspect: 1.032 },
  { id: 'flower-blue', label: 'Blue Flower', category: 'flowers', src: 'gems/flower-blue.png', aspect: 1.018 },
  { id: 'flower-green', label: 'Green Flower', category: 'flowers', src: 'gems/flower-green.png', aspect: 1.029 },
  { id: 'flower-teal', label: 'Teal Flower', category: 'flowers', src: 'gems/flower-teal.png', aspect: 1.018 },
];

export function getGemAsset(id: string): GemAsset | undefined {
  return GEM_CATALOGUE.find((asset) => asset.id === id);
}
