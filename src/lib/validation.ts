export function validateEmail(email: string): { isValid: boolean; error?: string } {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  
  if (!email) {
    return { isValid: false, error: 'Email is required' };
  }
  
  if (!emailRegex.test(email)) {
    return { isValid: false, error: 'Please enter a valid email address' };
  }
  
  return { isValid: true };
}

export function validatePassword(password: string): { isValid: boolean; error?: string } {
  if (!password) {
    return { isValid: false, error: 'Password is required' };
  }
  
  if (password.length < 8) {
    return { isValid: false, error: 'Password must be at least 8 characters long' };
  }
  
  if (!/[A-Z]/.test(password)) {
    return { isValid: false, error: 'Password must include at least one uppercase letter' };
  }
  
  if (!/[a-z]/.test(password)) {
    return { isValid: false, error: 'Password must include at least one lowercase letter' };
  }
  
  if (!/\d/.test(password)) {
    return { isValid: false, error: 'Password must include at least one number' };
  }
  
  return { isValid: true };
}

export function validatePhoneNumber(phoneNumber: string): { isValid: boolean; error?: string } {
  if (!phoneNumber) {
    return { isValid: false, error: 'Phone number is required' };
  }

  // Remove any spaces, dashes, or parentheses
  const cleanedNumber = phoneNumber.replace(/[\s\-\(\)]/g, '');

  // Check if the number starts with a plus sign (country code)
  if (!cleanedNumber.startsWith('+')) {
    return { isValid: false, error: 'Phone number must include country code (e.g., +1)' };
  }

  // Remove the plus sign for length check
  const numberWithoutPlus = cleanedNumber.slice(1);

  // Check if the number contains only digits
  if (!/^\d+$/.test(numberWithoutPlus)) {
    return { isValid: false, error: 'Phone number can only contain numbers and country code' };
  }

  // Check if the number is between 10 and 15 digits (international standard)
  if (numberWithoutPlus.length < 10 || numberWithoutPlus.length > 15) {
    return { isValid: false, error: 'Phone number must be between 10 and 15 digits' };
  }

  return { isValid: true };
} 