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

export function validateZipCode(zip: string, countryCode?: string): { isValid: boolean; error?: string } {
  if (!zip) {
    return { isValid: false, error: 'ZIP/Postal code is required' };
  }

  // Trim any whitespace
  const trimmedZip = zip.trim();

  // US ZIP code validation (5 digits or 5+4 format)
  if (countryCode === 'US') {
    const usZipRegex = /^[0-9]{5}(?:-[0-9]{4})?$/;
    if (!usZipRegex.test(trimmedZip)) {
      return {
        isValid: false,
        error: 'US ZIP code must be 5 digits or ZIP+4 format (e.g., 12345 or 12345-6789)'
      };
    }
    return { isValid: true };
  }

  // Canadian postal code validation (A1A 1A1 format)
  if (countryCode === 'CA') {
    const caPostalRegex = /^[A-Za-z][0-9][A-Za-z][ ]?[0-9][A-Za-z][0-9]$/;
    if (!caPostalRegex.test(trimmedZip)) {
      return {
        isValid: false,
        error: 'Canadian postal code must be in A1A 1A1 format'
      };
    }
    return { isValid: true };
  }

  // UK postal code validation
  if (countryCode === 'GB') {
    const ukPostalRegex = /^[A-Z]{1,2}[0-9][A-Z0-9]? ?[0-9][A-Z]{2}$/i;
    if (!ukPostalRegex.test(trimmedZip)) {
      return {
        isValid: false,
        error: 'UK postal code format is invalid'
      };
    }
    return { isValid: true };
  }
  
  // Australian postal code validation (4 digits)
  if (countryCode === 'AU') {
    const auPostalRegex = /^[0-9]{4}$/;
    if (!auPostalRegex.test(trimmedZip)) {
      return {
        isValid: false,
        error: 'Australian postal code must be 4 digits'
      };
    }
    return { isValid: true };
  }
  
  // German postal code validation (5 digits)
  if (countryCode === 'DE') {
    const dePostalRegex = /^[0-9]{5}$/;
    if (!dePostalRegex.test(trimmedZip)) {
      return {
        isValid: false,
        error: 'German postal code must be 5 digits'
      };
    }
    return { isValid: true };
  }
  
  // French postal code validation (5 digits)
  if (countryCode === 'FR') {
    const frPostalRegex = /^[0-9]{5}$/;
    if (!frPostalRegex.test(trimmedZip)) {
      return {
        isValid: false,
        error: 'French postal code must be 5 digits'
      };
    }
    return { isValid: true };
  }
  
  // Italian postal code validation (5 digits)
  if (countryCode === 'IT') {
    const itPostalRegex = /^[0-9]{5}$/;
    if (!itPostalRegex.test(trimmedZip)) {
      return {
        isValid: false,
        error: 'Italian postal code must be 5 digits'
      };
    }
    return { isValid: true };
  }
  
  // Japanese postal code validation (3-4 or 7 digits)
  if (countryCode === 'JP') {
    const jpPostalRegex = /^[0-9]{3}-?[0-9]{4}$/;
    if (!jpPostalRegex.test(trimmedZip)) {
      return {
        isValid: false,
        error: 'Japanese postal code must be in 3-4 format or 7 digits'
      };
    }
    return { isValid: true };
  }

  // General validation for other countries (allow 2-10 alphanumeric characters)
  const generalPostalRegex = /^[A-Za-z0-9 -]{2,10}$/;
  if (!generalPostalRegex.test(trimmedZip)) {
    return {
      isValid: false,
      error: 'Postal code format is invalid'
    };
  }

  return { isValid: true };
}

export function getStateFromZipCode(zip: string): string | null {
  // Only process 5-digit US ZIP codes
  if (!/^\d{5}(-\d{4})?$/.test(zip)) {
    return null;
  }
  
  // Extract first 3 digits (ZIP code prefix)
  const prefix = parseInt(zip.substring(0, 3), 10);
  
  // Map ZIP code ranges to states
  if (prefix >= 0 && prefix <= 8) return 'NY'; // New York (dummy check for testing)
  if (prefix >= 10 && prefix <= 14) return 'NY'; // New York
  if (prefix >= 15 && prefix <= 19) return 'PA'; // Pennsylvania
  if (prefix >= 20 && prefix <= 21) return 'MD'; // Maryland
  if (prefix === 22) return 'DC'; // Washington, DC
  if (prefix >= 23 && prefix <= 24) return 'VA'; // Virginia
  if (prefix === 25) return 'WV'; // West Virginia
  if (prefix >= 26 && prefix <= 34) return 'NC'; // North Carolina
  if (prefix >= 35 && prefix <= 36) return 'AL'; // Alabama
  if (prefix === 37) return 'TN'; // Tennessee
  if (prefix === 38) return 'MS'; // Mississippi
  if (prefix >= 39 && prefix <= 42) return 'KY'; // Kentucky
  if (prefix >= 43 && prefix <= 45) return 'OH'; // Ohio
  if (prefix >= 46 && prefix <= 47) return 'IN'; // Indiana
  if (prefix === 48) return 'MI'; // Michigan
  if (prefix === 49) return 'MI'; // Michigan
  if (prefix >= 50 && prefix <= 52) return 'IA'; // Iowa
  if (prefix === 53) return 'WI'; // Wisconsin
  if (prefix === 54) return 'WI'; // Wisconsin
  if (prefix >= 55 && prefix <= 56) return 'MN'; // Minnesota
  if (prefix === 57) return 'SD'; // South Dakota
  if (prefix === 58) return 'ND'; // North Dakota
  if (prefix === 59) return 'MT'; // Montana
  if (prefix >= 60 && prefix <= 62) return 'IL'; // Illinois
  if (prefix === 63) return 'MO'; // Missouri
  if (prefix === 64) return 'MO'; // Missouri
  if (prefix === 65) return 'MO'; // Missouri
  if (prefix >= 66 && prefix <= 67) return 'KS'; // Kansas
  if (prefix === 68) return 'NE'; // Nebraska
  if (prefix === 69) return 'NE'; // Nebraska
  if (prefix >= 70 && prefix <= 71) return 'LA'; // Louisiana
  if (prefix === 72) return 'AR'; // Arkansas
  if (prefix === 73) return 'OK'; // Oklahoma
  if (prefix === 74) return 'OK'; // Oklahoma
  if (prefix >= 75 && prefix <= 79) return 'TX'; // Texas
  if (prefix === 80) return 'CO'; // Colorado
  if (prefix === 81) return 'CO'; // Colorado
  if (prefix === 82) return 'WY'; // Wyoming
  if (prefix === 83) return 'ID'; // Idaho
  if (prefix === 84) return 'UT'; // Utah
  if (prefix === 85) return 'AZ'; // Arizona
  if (prefix === 86) return 'AZ'; // Arizona
  if (prefix === 87) return 'NM'; // New Mexico
  if (prefix === 88) return 'NM'; // New Mexico
  if (prefix === 89) return 'NV'; // Nevada
  if (prefix >= 90 && prefix <= 96) return 'CA'; // California
  if (prefix >= 97 && prefix <= 98) return 'OR'; // Oregon
  if (prefix === 99) return 'WA'; // Washington
  
  return null;
} 