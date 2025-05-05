// Export components from this directory
export { ProductBasicInfo } from './ProductBasicInfo';
export { CategorySelect } from './CategorySelect';
export { PricingCurveEditor } from './PricingCurveEditor'; 

// Re-export the main ProductForm component
// Note: This avoids the circular dependency by not importing directly from index.tsx
// Instead, we're informing TypeScript that ProductForm will be available from this module
export * from './index.tsx'; 