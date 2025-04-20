export function formatDateForInput(date: Date | null | undefined): string {
  if (!date) return '';
  const d = new Date(date);
  // Adjust for timezone offset to display in local time
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  // Format as ISO string and return the date and time portion (YYYY-MM-DDTHH:MM)
  // This is for the datetime-local input which expects this format
  return d.toISOString().slice(0, 16);
}

export function parseFormDate(dateString: string): Date {
  if (!dateString) throw new Error('Date string is required');
  
  // Create a date object from the input string (which is in local time format)
  const date = new Date(dateString);
  
  // Check if the date is valid
  if (isNaN(date.getTime())) throw new Error('Invalid date format');
  
  // Set seconds and milliseconds to zero for consistency
  // HTML datetime-local inputs don't support seconds, so we standardize here
  date.setSeconds(0);
  date.setMilliseconds(0);
  
  // When a datetime-local input's value is submitted, it's in the user's local timezone
  // We need to adjust it to get the correct UTC time that represents what the user selected
  return new Date(date.getTime() + date.getTimezoneOffset() * 60000);
}