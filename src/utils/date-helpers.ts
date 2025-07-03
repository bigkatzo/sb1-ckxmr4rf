import { formatDistanceToNow, formatDistanceToNowStrict, isAfter } from 'date-fns';

/**
 * SIMPLEST POSSIBLE DATE HANDLING
 * 
 * User says "14:00" → Store as "14:00 UTC" → Display as "14:00 local"
 * No timezone math, just store what user wants and show what they expect
 */

// Convert user input to UTC (treating input as desired UTC time)
export function parseFormDate(dateString: string): Date {
  if (!dateString) throw new Error('Date string is required');
  
  // User input: "2025-07-03T14:00"
  // We want to store this as 14:00 UTC, not convert timezones
  return new Date(dateString + ':00.000Z');
}

// Convert UTC back to input format (strip timezone info)
export function formatDateForInput(date: Date | string | null | undefined): string {
  if (!date) return '';
  
  const utcDate = typeof date === 'string' ? new Date(date) : date;
  
  if (isNaN(utcDate.getTime())) {
    console.error('Invalid date provided to formatDateForInput:', date);
    return '';
  }
  
  // Just return the UTC time as local time format for the input
  return utcDate.toISOString().slice(0, 16);
}

// Standard date format options
export const DATE_FORMAT_OPTIONS = {
  short: {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  } as const,
  
  medium: {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric'
  } as const,
  
  long: {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    timeZoneName: 'short'
  } as const,
  
  full: {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long',
    hour: 'numeric',
    minute: 'numeric',
    timeZoneName: 'long'
  } as const
};

// Format dates for display
export function formatDate(date: Date | string | null | undefined, style: keyof typeof DATE_FORMAT_OPTIONS = 'medium'): string {
  if (!date) return '';
  const dateObj = new Date(date);
  
  if (isNaN(dateObj.getTime())) {
    console.error('Invalid date provided to formatDate:', date);
    return '';
  }
  
  try {
    return new Intl.DateTimeFormat('en-US', DATE_FORMAT_OPTIONS[style]).format(dateObj);
  } catch (error) {
    console.error('Error formatting date:', error);
    return dateObj.toLocaleDateString();
  }
}

// Format relative time
export function formatRelativeTime(date: Date | string | null | undefined): string {
  if (!date) return '';
  const d = new Date(date);
  const now = new Date();
  const isInFuture = isAfter(d, now);
  
  return isInFuture
    ? `in ${formatDistanceToNowStrict(d)}`
    : `${formatDistanceToNow(d)} ago`;
}

// Get user's timezone
export function getUserTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

// Check if date is in future
export function isFutureDate(date: Date | string | null | undefined): boolean {
  if (!date) return false;
  const d = new Date(date);
  if (isNaN(d.getTime())) return false;
  
  return d.getTime() > Date.now();
}

// Check if date is in past
export function isPastDate(date: Date | string | null | undefined): boolean {
  if (!date) return false;
  const dateObj = new Date(date);
  return dateObj < new Date();
}

// Format countdown timer
export function formatCountdown(targetDate: Date | string): string {
  const target = new Date(targetDate);
  const now = new Date();
  const diff = target.getTime() - now.getTime();
  
  if (diff <= 0) return 'Launched';
  
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

// Format date range
export function formatDateRange(startDate: Date | string | null | undefined, endDate: Date | string | null | undefined, format: keyof typeof DATE_FORMAT_OPTIONS = 'medium'): string {
  if (!startDate || !endDate) return '';
  
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    console.error('Invalid date range:', { startDate, endDate });
    return '';
  }
  
  return `${formatDate(start, format)} - ${formatDate(end, format)}`;
}