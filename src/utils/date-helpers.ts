import { formatDistanceToNow, formatDistanceToNowStrict, isAfter } from 'date-fns';

// Format a date for datetime-local input
export function formatDateForInput(date: Date | null | undefined): string {
  if (!date) return '';
  
  // Ensure we have a valid date object
  const utcDate = new Date(date);
  if (isNaN(utcDate.getTime())) {
    console.error('Invalid date provided to formatDateForInput:', date);
    return '';
  }
  
  // Convert UTC to local time
  const year = utcDate.getFullYear();
  const month = String(utcDate.getMonth() + 1).padStart(2, '0');
  const day = String(utcDate.getDate()).padStart(2, '0');
  const hours = String(utcDate.getHours()).padStart(2, '0');
  const minutes = String(utcDate.getMinutes()).padStart(2, '0');
  
  // Format as YYYY-MM-DDTHH:mm
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

// Parse a date from datetime-local input
export function parseFormDate(dateString: string): Date {
  if (!dateString) throw new Error('Date string is required');
  
  // Create a date object from the input string (which is in local time)
  const [datePart, timePart] = dateString.split('T');
  if (!datePart || !timePart) throw new Error('Invalid date format');
  
  const [year, month, day] = datePart.split('-').map(Number);
  const [hours, minutes] = timePart.split(':').map(Number);
  
  if ([year, month, day, hours, minutes].some(isNaN)) {
    throw new Error('Invalid date format');
  }
  
  // Create a date in local time
  const localDate = new Date(year, month - 1, day, hours, minutes);
  
  // Convert to UTC
  const utcDate = new Date(
    localDate.getTime() + localDate.getTimezoneOffset() * 60000
  );
  
  return utcDate;
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

// Format a date with consistent styling and timezone handling
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

// Format relative time (e.g., "2 hours ago", "in 3 days")
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

// Check if a date is in the future
export function isFutureDate(date: Date | string | null | undefined): boolean {
  if (!date) return false;
  const d = new Date(date);
  if (isNaN(d.getTime())) return false;
  // Compare using UTC timestamps to avoid timezone issues
  return d.getTime() > Date.now();
}

// Check if a date is in the past
export function isPastDate(date: Date | string | null | undefined): boolean {
  if (!date) return false;
  const dateObj = new Date(date);
  return dateObj < new Date();
}

// Format a countdown timer
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

// Format a date range
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