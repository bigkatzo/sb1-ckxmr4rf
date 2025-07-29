import { z } from 'zod';
import type { ProductVariant, VariantPricing } from '../../../../types/variants';

// Create a generic file type for Zod since File is not a native Zod type
const fileSchema = z.any().refine((file) => file instanceof File || file === undefined || file === null, {
  message: 'Expected a File object',
});

// Define array schemas
const fileArraySchema = z.array(fileSchema).default([]);
const stringArraySchema = z.array(z.string()).default([]);

// Create variants and pricing schemas
const variantSchema = z.array(z.any()).default([]);
const variantPricingSchema = z.record(z.any()).default({});

// Notes schema - all fields are optional strings with default empty values
const notesSchema = z.object({
  shipping: z.string().optional().default(''),
  quality: z.string().optional().default(''),
  returns: z.string().optional().default('')
}).default({
  shipping: '',
  quality: '',
  returns: ''
});

// Core product schema for validation
export const productSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().min(1, 'Description is required'),
  price: z.number().min(0.01, 'Price must be at least 0.01'),
  stock: z.number().nullable(),
  categoryId: z.string().min(1, 'Category is required'),
  sku: z.string().optional(),
  minimumOrderQuantity: z.number().min(1, 'Minimum order quantity must be at least 1'),
  visible: z.boolean().default(true),
  saleEnded: z.boolean().default(false),
  pinOrder: z.number().nullable().default(null),
  blankCode: z.string().optional().default(''),
  technique: z.string().optional().default(''),
  noteForSupplier: z.string().optional().default(''),
  priceModifierBeforeMin: z.number()
    .min(-1, 'Discount cannot exceed 100%')
    .max(0, 'Pre-MOQ modifier must be 0 or negative (discount)')
    .nullable(),
  priceModifierAfterMin: z.number()
    .min(0, 'Post-MOQ modifier must be 0 or positive (increase)')
    .nullable(),
  notes: notesSchema,
  freeNotes: z.string().optional().default(''),
  // Add additional fields for form management
  variants: variantSchema,
  variantPrices: variantPricingSchema,
  imageFiles: fileArraySchema,
  existingImages: stringArraySchema,
  removedImages: stringArraySchema,
  designFiles: fileArraySchema,
  existingDesignFiles: stringArraySchema,
  removedDesignFiles: stringArraySchema,
  isCustomizable: z.string().optional().default('no'),
  customization: z.object({
    image: z.boolean().optional().default(false),
    text: z.boolean().optional().default(false),
  }).optional(),
});

// Basic product form values from schema
export type ProductFormValues = z.infer<typeof productSchema>;

// For TypeScript type safety when working with the form
export interface ExtendedProductFormValues extends ProductFormValues {
  variants: ProductVariant[];
  variantPrices: VariantPricing;
  imageFiles: File[];
  existingImages: string[];
  removedImages: string[];
  designFiles: File[];
  existingDesignFiles: string[];
  removedDesignFiles: string[];
} 