import { describe, it, expect } from 'vitest';
import { generateUniqueFileName, generateSafeFilename } from '../lib/storage';
import path from 'path';

describe('Filename Generation Functions', () => {
  // Test generateUniqueFileName
  describe('generateUniqueFileName', () => {
    it('should generate a unique filename with collection format', () => {
      const result = generateUniqueFileName('test.jpg');
      
      // Validate format: collection+random+date.jpg
      expect(result).toMatch(/^default[a-z0-9]{12}\d{14}\.jpg$/);
      expect(result).not.toContain('test');
    });
    
    it('should accept custom collection prefix', () => {
      const result = generateUniqueFileName('test.jpg', 'products');
      
      // Validate format: products+random+date.jpg
      expect(result).toMatch(/^products[a-z0-9]{12}\d{14}\.jpg$/);
      expect(result).not.toContain('test');
    });
    
    it('should handle filenames with special characters', () => {
      const result = generateUniqueFileName('test (1) with spaces.jpg');
      
      // Should only have collection+random+date.jpg pattern
      expect(result).toMatch(/^default[a-z0-9]{12}\d{14}\.jpg$/);
      expect(result).not.toContain('test');
      expect(result).not.toContain('spaces');
    });
    
    it('should preserve file extension in lowercase', () => {
      const result = generateUniqueFileName('test.JPG');
      expect(result.endsWith('.jpg')).toBe(true);
    });
    
    it('should handle unusual file extensions', () => {
      const result = generateUniqueFileName('test.WEBP');
      expect(result.endsWith('.webp')).toBe(true);
    });
  });
  
  // Test generateSafeFilename
  describe('generateSafeFilename', () => {
    it('should generate a unique filename with collection format', () => {
      const result = generateSafeFilename('test.jpg');
      
      // Validate format: collection+random+date.jpg
      expect(result).toMatch(/^default[a-z0-9]{12}\d{14}\.jpg$/);
      expect(result).not.toContain('test');
    });
    
    it('should accept custom collection prefix', () => {
      const result = generateSafeFilename('test.jpg', 'products');
      
      // Validate format: products+random+date.jpg
      expect(result).toMatch(/^products[a-z0-9]{12}\d{14}\.jpg$/);
      expect(result).not.toContain('test');
    });
    
    it('should handle filenames with special characters', () => {
      const result = generateSafeFilename('test (1) with spaces.jpg');
      
      // Should only have collection+random+date.jpg pattern
      expect(result).toMatch(/^default[a-z0-9]{12}\d{14}\.jpg$/);
      expect(result).not.toContain('test');
      expect(result).not.toContain('spaces');
    });
    
    it('should preserve file extension correctly', () => {
      const result = generateSafeFilename('test.PNG');
      const ext = path.extname(result);
      expect(ext.toLowerCase()).toBe('.png');
    });
  });
  
  // Test uniqueness
  describe('Uniqueness', () => {
    it('should generate different filenames for the same input', () => {
      const result1 = generateUniqueFileName('test.jpg');
      
      // Small delay to ensure different timestamp
      const delay = () => new Promise(resolve => setTimeout(resolve, 10));
      
      return delay().then(() => {
        const result2 = generateUniqueFileName('test.jpg');
        expect(result1).not.toEqual(result2);
      });
    });
    
    it('should generate different filenames with generateSafeFilename', () => {
      const result1 = generateSafeFilename('test.jpg');
      
      // Small delay to ensure different timestamp
      const delay = () => new Promise(resolve => setTimeout(resolve, 10));
      
      return delay().then(() => {
        const result2 = generateSafeFilename('test.jpg');
        expect(result1).not.toEqual(result2);
      });
    });
  });
}); 