import { v4 as uuidv4 } from 'uuid';

// Generate a UUID for new collections
export function generateCollectionId(): string {
  return uuidv4();
}

// Generate a product ID with UUID
export function generateProductId(): string {
  return uuidv4();
}

// Generate a URL-friendly slug from a string
export function generateSlug(str: string, includeId = false): string {
  const baseSlug = str
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '') // Remove special characters
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Replace multiple hyphens with single hyphen
    .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens

  if (includeId) {
    // Add a short unique identifier for products
    const uniqueId = Math.random().toString(36).substring(2, 7);
    return `${baseSlug}-${uniqueId}`;
  }

  return baseSlug;
}