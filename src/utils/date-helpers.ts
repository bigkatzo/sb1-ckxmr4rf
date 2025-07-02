export function formatDateForInput(date: Date | null | undefined): string {
  if (!date) return '';
  const d = new Date(date);
  // Format as ISO string and return the date and time portion (YYYY-MM-DDTHH:MM)
  // This is for the datetime-local input which expects this format
  return d.toISOString().slice(0, 16);
}

export function parseFormDate(dateString: string): Date {
  if (!dateString) throw new Error('Date string is required');
  
  // Create a date object from the input string
  const date = new Date(dateString);
  
  // Check if the date is valid
  if (isNaN(date.getTime())) throw new Error('Invalid date format');
  
  // Set seconds and milliseconds to zero for consistency
  date.setSeconds(0);
  date.setMilliseconds(0);
  
  return date;
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
export function formatDate(date: Date | string | null | undefined, format: keyof typeof DATE_FORMAT_OPTIONS = 'medium'): string {
  if (!date) return '';
  const dateObj = new Date(date);
  
  if (isNaN(dateObj.getTime())) {
    console.error('Invalid date provided to formatDate:', date);
    return '';
  }
  
  try {
    return new Intl.DateTimeFormat('en-US', DATE_FORMAT_OPTIONS[format]).format(dateObj);
  } catch (error) {
    console.error('Error formatting date:', error);
    return '';
  }
}

// Format a date relative to now (e.g., "2 hours ago", "in 3 days")
export function formatRelativeTime(date: Date | string | null | undefined): string {
  if (!date) return '';
  const dateObj = new Date(date);
  
  if (isNaN(dateObj.getTime())) {
    console.error('Invalid date provided to formatRelativeTime:', date);
    return '';
  }
  
  const now = new Date();
  const diffInSeconds = (dateObj.getTime() - now.getTime()) / 1000;
  const absSeconds = Math.abs(diffInSeconds);
  
  // Helper function to format the relative time
  const formatTime = (value: number, unit: Intl.RelativeTimeFormatUnit): string => {
    const rtf = new Intl.RelativeTimeFormat('en-US', { numeric: 'auto' });
    return rtf.format(diffInSeconds > 0 ? Math.ceil(value) : -Math.ceil(value), unit);
  };
  
  if (absSeconds < 60) return 'just now';
  if (absSeconds < 3600) return formatTime(diffInSeconds / 60, 'minute');
  if (absSeconds < 86400) return formatTime(diffInSeconds / 3600, 'hour');
  if (absSeconds < 2592000) return formatTime(diffInSeconds / 86400, 'day');
  if (absSeconds < 31536000) return formatTime(diffInSeconds / 2592000, 'month');
  return formatTime(diffInSeconds / 31536000, 'year');
}

// Get timezone abbreviation for the current user
export function getUserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch (error) {
    console.error('Error getting user timezone:', error);
    return 'UTC';
  }
}

// Check if a date is in the future
export function isFutureDate(date: Date | string | null | undefined): boolean {
  if (!date) return false;
  const dateObj = new Date(date);
  return dateObj > new Date();
}

// Check if a date is in the past
export function isPastDate(date: Date | string | null | undefined): boolean {
  if (!date) return false;
  const dateObj = new Date(date);
  return dateObj < new Date();
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