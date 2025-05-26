import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Combines and merges class names with Tailwind's utility classes, safely
 * Prevents conflicts when combining utility classes
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
} 