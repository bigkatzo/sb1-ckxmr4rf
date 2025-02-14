export function isValidCollectionSlug(slug: unknown): slug is string {
  return typeof slug === 'string' && 
         slug !== 'undefined' && 
         slug.length > 0 && 
         /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug);
}