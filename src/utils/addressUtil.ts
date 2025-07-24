import { getCountryByCode, getCountryByName } from '../data/countries';
import { getStateFromZipCode } from '../lib/validation';

/**
 * Countries that require tax ID for shipping
 */
export const COUNTRIES_REQUIRING_TAX_ID = ['ZA', 'MX', 'NO', 'CL', 'TR', 'KR', 'BR'];

/**
 * Countries that are not supported for shipping
 */
export const UNSUPPORTED_SHIPPING_COUNTRIES = ['IN']; // India // South Africa, Mexico, Norway, Chile, Turkey, Republic of Korea

/**
 * Check if a country requires tax ID for shipping
 */
export function doesCountryRequireTaxId(countryCodeOrName: string): boolean {
  const countryInfo = getCountryInfo(countryCodeOrName);
  return countryInfo ? COUNTRIES_REQUIRING_TAX_ID.includes(countryInfo.code) : false;
}

/**
 * Check if a country is supported for shipping
 */
export function isCountrySupportedForShipping(countryCodeOrName: string): boolean {
  const countryInfo = getCountryInfo(countryCodeOrName);
  return countryInfo ? !UNSUPPORTED_SHIPPING_COUNTRIES.includes(countryInfo.code) : true;
}

/**
 * Format a complete address for display
 */
export function formatAddress(address: {
  address: string;
  city: string;
  state?: string;
  country: string;
  zip: string;
}): string {
  const { address: street, city, state, country, zip } = address;
  
  let formattedAddress = street;
  
  // Add city, state and zip
  if (city || state || zip) {
    formattedAddress += '\n';
    
    if (city) {
      formattedAddress += city;
    }
    
    if (state) {
      formattedAddress += city ? `, ${state}` : state;
    }
    
    if (zip) {
      formattedAddress += (city || state) ? ' ' + zip : zip;
    }
  }
  
  // Add country
  if (country) {
    formattedAddress += '\n' + country;
  }
  
  return formattedAddress;
}

/**
 * Gets country information from either code or full name
 */
export function getCountryInfo(countryNameOrCode: string): { name: string; code: string } | null {
  // Try first as a country code
  let country = getCountryByCode(countryNameOrCode);
  
  // If not found, try as a country name
  if (!country) {
    country = getCountryByName(countryNameOrCode);
  }
  
  if (!country) {
    return null;
  }
  
  return {
    name: country.name,
    code: country.code
  };
}

/**
 * Try to detect country from ZIP code format
 */
export function detectCountryFromZip(zip: string): string | null {
  // Clean the ZIP code
  const cleanZip = zip.trim();
  
  // US ZIP code: 5 digits or 5+4 format
  if (/^[0-9]{5}(-[0-9]{4})?$/.test(cleanZip)) {
    return 'US';
  }
  
  // Canadian postal code: A1A 1A1 format
  if (/^[A-Za-z][0-9][A-Za-z][ ]?[0-9][A-Za-z][0-9]$/.test(cleanZip)) {
    return 'CA';
  }
  
  // UK postal code: complex format
  if (/^[A-Z]{1,2}[0-9][A-Z0-9]? ?[0-9][A-Z]{2}$/i.test(cleanZip)) {
    return 'GB';
  }
  
  // Australian postal code: 4 digits
  if (/^[0-9]{4}$/.test(cleanZip)) {
    return 'AU';
  }
  
  return null;
}

/**
 * Try to get state and country info from a ZIP code
 */
export function getLocationFromZip(zip: string): { country: string; state?: string } | null {
  // Try to detect country from ZIP
  const countryCode = detectCountryFromZip(zip);
  
  if (!countryCode) {
    return null;
  }
  
  // Get country name
  const country = getCountryByCode(countryCode);
  
  if (!country) {
    return null;
  }
  
  // For US, try to get state
  let state: string | null = null;
  if (countryCode === 'US') {
    state = getStateFromZipCode(zip);
  }
  
  return {
    country: country.name,
    state: state ? country.states?.[state]?.[0] : undefined
  };
}

/**
 * Get formatted address for shipping carriers
 */
export function getCarrierFormattedAddress(address: {
  address: string;
  city: string;
  state?: string;
  country: string;
  zip: string;
}): string {
  const { address: street, city, state, country, zip } = address;
  
  // Get country code
  const countryInfo = getCountryInfo(country);
  const countryCode = countryInfo?.code || '';
  
  // Different formats for different countries
  if (countryCode === 'US') {
    return `${street}\n${city}, ${state || ''} ${zip}\nUnited States of America`;
  }
  
  if (countryCode === 'CA') {
    return `${street}\n${city}, ${state || ''} ${zip}\nCanada`;
  }
  
  if (countryCode === 'GB') {
    return `${street}\n${city} ${zip}\nUnited Kingdom`;
  }
  
  // Default format
  const statePart = state ? `, ${state}` : '';
  return `${street}\n${city}${statePart} ${zip}\n${country}`;
} 