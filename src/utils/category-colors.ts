// Define default color set to use as fallback
const DEFAULT_COLOR_SET = {
  base: 'text-purple-500',
  light: 'text-purple-400',
  bg: 'bg-purple-500/10'
};

// Define color sets for different categories
export const CATEGORY_COLORS = [
  { base: 'text-emerald-500', light: 'text-emerald-400', bg: 'bg-emerald-500/10' },
  { base: 'text-amber-500', light: 'text-amber-400', bg: 'bg-amber-500/10' },
  { base: 'text-purple-500', light: 'text-purple-400', bg: 'bg-purple-500/10' },
  { base: 'text-blue-500', light: 'text-blue-400', bg: 'bg-blue-500/10' },
  { base: 'text-rose-500', light: 'text-rose-400', bg: 'bg-rose-500/10' },
  { base: 'text-cyan-500', light: 'text-cyan-400', bg: 'bg-cyan-500/10' }
];

export function getCategoryColorSet(index: number) {
  // Handle invalid or out of bounds indices
  if (typeof index !== 'number' || !Number.isFinite(index) || index < 0) {
    return DEFAULT_COLOR_SET;
  }

  // Use modulo to wrap around the color array
  const safeIndex = index % CATEGORY_COLORS.length;
  return CATEGORY_COLORS[safeIndex] || DEFAULT_COLOR_SET;
}