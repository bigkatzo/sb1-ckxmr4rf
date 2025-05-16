# Modal System Optimization Guide

## Current Implementation Status

The current modal system in store.fun uses a combination of approaches:

1. **Base Modal Components**: 
   - `src/components/ui/Modal/Modal.tsx` - Main implementation for merchant dashboard
   - `src/components/ui/Modal.tsx` - Alternative implementation used in some places

2. **Z-index Management**:
   - Inline styles with URL-based detection for merchant dashboard
   - Global CSS selectors with complex specificity rules
   - Component-specific z-index values

3. **Form Wrappers**:
   - `ModalForm` component built on the base Modal

4. **Known Issues**:
   - Inconsistent z-index handling causing stacking issues
   - Duplicate implementations with subtle differences
   - CSS specificity battles leading to unexpected behaviors
   - Fragile detection methods for context-specific styling

## Target Architecture

### 1. Z-index Token System

Create a centralized z-index management system using design tokens:

```typescript
// src/styles/z-index.ts
export const zIndex = {
  // Core application layers
  navigation: 50,
  
  // Storefront specific layers
  storefront: {
    modal: 45,
    modalBackdrop: 40,
    modalContent: 46,
    cartDrawerBackdrop: 55,
    cartDrawerContent: 60,
    tokenVerification: 70,
    stripePayment: 80,
    successView: 90,
    howItWorks: 100,
  },
  
  // Merchant dashboard specific layers
  merchant: {
    modal: 9999,
    modalBackdrop: 9000,
    modalContent: 9001,
  },
  
  // Shared top-level elements
  toasts: 99999,
}
```

### 2. Context-Aware Modal System

Implement a context-based modal provider:

```typescript
// src/contexts/ModalContext.tsx
import React, { createContext, useContext, useState } from 'react';

type ModalEnvironment = 'storefront' | 'merchant';

interface ModalContextValue {
  environment: ModalEnvironment;
}

const ModalContext = createContext<ModalContextValue>({ environment: 'storefront' });

export function ModalContextProvider({ 
  children, 
  environment 
}: { 
  children: React.ReactNode;
  environment: ModalEnvironment;
}) {
  return (
    <ModalContext.Provider value={{ environment }}>
      {children}
    </ModalContext.Provider>
  );
}

export const useModalContext = () => useContext(ModalContext);
```

### 3. Unified Modal Component

Create a single, context-aware modal implementation:

```tsx
// src/components/ui/Modal/Modal.tsx
import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import { usePreventScroll } from '../../../hooks/usePreventScroll';
import { useModalContext } from '../../../contexts/ModalContext';
import { zIndex } from '../../../styles/z-index';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  className?: string;
}

export function Modal({ isOpen, onClose, title, children, className = '' }: ModalProps) {
  const { environment } = useModalContext();
  usePreventScroll(isOpen);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  if (!isOpen) return null;

  // Get z-index values based on environment
  const containerZIndex = environment === 'merchant' 
    ? zIndex.merchant.modal 
    : zIndex.storefront.modal;
    
  const backdropZIndex = environment === 'merchant' 
    ? zIndex.merchant.modalBackdrop 
    : zIndex.storefront.modalBackdrop;
    
  const contentZIndex = environment === 'merchant' 
    ? zIndex.merchant.modalContent 
    : zIndex.storefront.modalContent;

  return (
    <div 
      className="fixed inset-0"
      aria-modal="true" 
      role="dialog"
      aria-labelledby="modal-title"
      data-environment={environment}
      style={{ zIndex: containerZIndex }}
    >
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/80 backdrop-blur-sm" 
        onClick={onClose}
        style={{ zIndex: backdropZIndex }}
      />
      
      {/* Modal content */}
      <div 
        className="fixed inset-0 overflow-y-auto"
        style={{ zIndex: contentZIndex }}
      >
        <div className="min-h-full flex items-center justify-center p-4">
          <div className={`relative w-full sm:w-auto bg-gray-900 sm:rounded-xl shadow-xl overflow-hidden ${className}`}>
            <div className="sticky top-0 bg-gray-900 z-10 flex justify-between items-center p-4 sm:p-6 border-b border-gray-800">
              <h2 id="modal-title" className="text-xl font-semibold">{title}</h2>
              <button 
                onClick={onClose} 
                className="text-gray-400 hover:text-white p-2 rounded-lg transition-colors"
                aria-label="Close modal"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="max-h-[calc(100vh-8rem)] overflow-y-auto scroll-smooth scrollbar-hide">
              {children}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
```

## Implementation Plan

### Phase 1: Design Token System

1. **Create z-index token file**:
   - Implement `src/styles/z-index.ts` with all z-index values
   - Document each z-index value with its purpose and stacking context
   - Add validation to prevent accidental overlaps

2. **Remove global CSS z-index rules**:
   - Remove all z-index values from `src/index.css`
   - Transition to token-based approach

### Phase 2: Context Provider Implementation

1. **Create Modal Context**:
   - Implement the `ModalContext` and provider
   - Add to application wrappers (merchant layout, storefront layout)

2. **Update Layout Components**:
   - Wrap the merchant dashboard in `<ModalContextProvider environment="merchant">`
   - Wrap the storefront in `<ModalContextProvider environment="storefront">`

### Phase 3: Unify Modal Components

1. **Refactor Base Modal Component**:
   - Update Modal component to use context and z-index tokens
   - Add proper TypeScript typing and documentation
   - Implement responsive improvements

2. **Standardize Form Components**:
   - Update ModalForm to use new Modal component
   - Standardize form layouts and behaviors
   - Create common form building blocks (field groups, validation displays)

3. **Deprecate Duplicate Implementations**:
   - Identify all custom modal implementations
   - Migrate to standardized components
   - Add deprecation warnings to legacy components

### Phase 4: Enhanced Features & Testing

1. **Add Animation System**:
   - Implement consistent entrance/exit animations
   - Add support for different animation types

2. **Accessibility Improvements**:
   - Ensure keyboard navigation works correctly
   - Add proper focus management
   - Test with screen readers

3. **Responsive Enhancements**:
   - Improve mobile experience
   - Handle different viewport sizes gracefully

4. **Stacking Context Tests**:
   - Create visual regression tests for modal stacking
   - Test all possible modal configurations and combinations

## Best Practices

### Z-index Management

1. **Use the z-index token system exclusively**:
   ```typescript
   import { zIndex } from '../styles/z-index';
   
   // Good
   <div style={{ zIndex: zIndex.merchant.modal }}>
   
   // Bad
   <div className="z-50">
   <div style={{ zIndex: 9999 }}>
   ```

2. **Keep proper layering sequence**:
   - Modal container should have highest z-index
   - Modal content should be above backdrop
   - Backdrop should be above page content
   - Never manipulate z-index values directly

### Modal Component Usage

1. **Always use the standard Modal components**:
   ```tsx
   // Good
   import { Modal } from '../ui/Modal/Modal';
   import { ModalForm } from '../ui/Modal/ModalForm';
   
   // Bad
   <div className="fixed inset-0 z-50">...</div>
   ```

2. **Provide proper accessibility attributes**:
   - Always include titles
   - Use proper ARIA roles and attributes
   - Ensure keyboard navigation works

### Context Providers

1. **Always wrap application sections properly**:
   - Merchant dashboard should use 'merchant' environment
   - Storefront should use 'storefront' environment
   - Never mix environments

2. **Test with context**:
   - Write tests that verify correct context is being used
   - Test boundary conditions between environments

## General Structure Standardization

To ensure consistency and maintainability between the merchant dashboard and storefront components, we need to establish clear standards and boundaries.

### Component Organization

1. **Directory Structure**:
   ```
   src/
   ├── components/
   │   ├── common/         # Truly shared components with no environment assumptions
   │   ├── merchant/       # Merchant-only components
   │   ├── storefront/     # Storefront-only components
   │   └── ui/             # Base UI components that can be used in both environments
   │       ├── forms/
   │       ├── layout/
   │       ├── Modal/      # Unified modal system components
   │       └── feedback/   # Loaders, notifications, etc.
   ```

2. **Environment-Based Styling**:
   - Create environment-specific themes with shared tokens
   - Use CSS modules or styled-components with environment awareness
   - Ensure responsive design works in both environments

### Shared Components vs Environment-Specific Components

1. **Shared UI Components**:
   - Should be environment-agnostic or adapt to environment via context
   - Must not have hard-coded z-index values
   - Should use design tokens for consistent styling
   - Should have comprehensive prop interfaces with defaults
   - Must include accessibility support

2. **Environment-Specific Wrappers**:
   - Create specialized higher-order components for each environment
   - Example: `MerchantButton` and `StorefrontButton` both using shared `Button`

### State Management Standardization

1. **Context Usage**:
   - Create environment-specific contexts for merchant/storefront
   - Use unified patterns for accessing global state
   - Implement clear boundaries between state domains

2. **Form State Handling**:
   - Standardize on a single form library (react-hook-form, formik, etc.)
   - Create consistent validation patterns
   - Use shared field components with environment-specific styling

### Data Fetching Pattern

1. **API Service Layer**:
   - Create environment-specific API services that share common utilities
   - Implement consistent error handling and loading states
   - Use environment context to determine endpoint behaviors

2. **Data Caching Strategy**:
   - Implement consistent caching for both environments
   - Share cache utilities while maintaining environment isolation

### Feature Parity Where Appropriate

1. **Modal Patterns**:
   - Ensure same modal behaviors in both environments
   - Use consistent animation patterns
   - Standardize form layout within modals

2. **Table/List Views**:
   - Create consistent data display patterns
   - Share sorting, filtering, and pagination logic
   - Maintain environment-specific styling

### Code Splitting and Performance

1. **Bundle Optimization**:
   - Split merchant and storefront code into separate bundles
   - Share only truly common components
   - Implement proper code splitting for each environment

2. **Performance Budgets**:
   - Establish loading time targets for each environment
   - Create component-level performance expectations
   - Implement monitoring for both environments

### Migration Strategy

1. **Incremental Adoption**:
   - Start with high-impact, shared components (modals, forms)
   - Move environment-specific logic to wrappers
   - Gradually refactor existing components

2. **Component Inventory**:
   - Create a catalog of all current components
   - Map each to their standardized location
   - Create migration priority list based on usage and impact

### Example Implementation

For a button component used in both environments:

```tsx
// src/components/ui/Button.tsx
import React from 'react';
import { useEnvironment } from '../../contexts/EnvironmentContext';
import { tokens } from '../../styles/tokens';

interface ButtonProps {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
}

export function Button({ 
  children, 
  variant = 'primary', 
  size = 'md', 
  onClick, 
  disabled, 
  className = '' 
}: ButtonProps) {
  const { environment } = useEnvironment();
  
  // Base classes shared by both environments
  const baseClasses = "font-medium rounded transition-colors focus:outline-none focus:ring-2";
  
  // Size classes shared by both environments
  const sizeClasses = {
    sm: "px-3 py-1.5 text-sm",
    md: "px-4 py-2",
    lg: "px-6 py-3 text-lg"
  }[size];
  
  // Environment and variant specific classes
  const variantClasses = {
    merchant: {
      primary: "bg-blue-600 hover:bg-blue-700 text-white focus:ring-blue-500/50",
      secondary: "bg-gray-700 hover:bg-gray-600 text-gray-100 focus:ring-gray-500/50",
      danger: "bg-red-600 hover:bg-red-700 text-white focus:ring-red-500/50"
    },
    storefront: {
      primary: "bg-emerald-600 hover:bg-emerald-700 text-white focus:ring-emerald-500/50",
      secondary: "bg-gray-800 hover:bg-gray-700 text-gray-100 focus:ring-gray-600/50",
      danger: "bg-red-700 hover:bg-red-800 text-white focus:ring-red-600/50"
    }
  }[environment][variant];

  const disabledClasses = disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer";
  
  return (
    <button
      className={`${baseClasses} ${sizeClasses} ${variantClasses} ${disabledClasses} ${className}`}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
}

// Environment-specific wrappers for convenience
// src/components/merchant/MerchantButton.tsx
export function MerchantButton(props: ButtonProps) {
  // Could add merchant-specific defaults or behaviors here
  return <Button {...props} />;
}

// src/components/storefront/StorefrontButton.tsx
export function StorefrontButton(props: ButtonProps) {
  // Could add storefront-specific defaults or behaviors here
  return <Button {...props} />;
}
```

## CSS Architecture & Styling Patterns

To maintain consistency, performance, and maintainability across both merchant dashboard and storefront, we need a standardized approach to CSS and component styling.

### CSS Framework & Methodology

1. **Tailwind CSS Usage Guidelines**:
   - Maintain a consistent pattern for class ordering:
     ```html
     <!-- Recommended class ordering -->
     <div class="
       /* Layout (display, position) */
       flex absolute inset-0
       
       /* Spacing (margin, padding) */
       m-4 p-6
       
       /* Sizing (width, height) */
       w-full max-w-md h-auto
       
       /* Visual (colors, borders, shadows) */
       bg-gray-900 border border-gray-800 rounded-xl shadow-lg
       
       /* Typography */
       text-white text-lg font-medium
       
       /* Interactive & states */
       hover:bg-gray-800 focus:ring-2
       
       /* Other/custom */
       scrollbar-hide
     ">
     ```
   
   - Use consistent color patterns with semantic names:
     ```html
     <!-- Merchant Dashboard -->
     <button class="bg-merchant-primary hover:bg-merchant-primary-hover text-merchant-on-primary">
     
     <!-- Storefront -->
     <button class="bg-store-primary hover:bg-store-primary-hover text-store-on-primary">
     ```

2. **CSS Custom Properties (Variables)**:
   - Create environment-specific theme variables:
     ```css
     /* Base theme variables */
     :root {
       /* Base colors */
       --color-black: #030712;
       --color-white: #ffffff;
       
       /* Shared feedback colors */
       --color-error: #ef4444;
       --color-success: #10b981;
       --color-warning: #f59e0b;
       
       /* Spacing */
       --spacing-unit: 0.25rem;
       --radius-sm: 0.25rem;
       --radius-md: 0.5rem;
       --radius-lg: 1rem;
     }
     
     /* Merchant Dashboard Theme */
     [data-environment="merchant"] {
       --primary: #3b82f6;
       --primary-hover: #2563eb;
       --on-primary: #ffffff;
       
       --surface: #111827;
       --surface-hover: #1f2937;
       --on-surface: #f9fafb;
       
       --z-modal: 9999;
       --z-modal-backdrop: 9000;
       --z-modal-content: 9001;
     }
     
     /* Storefront Theme */
     [data-environment="storefront"] {
       --primary: #10b981;
       --primary-hover: #059669;
       --on-primary: #ffffff;
       
       --surface: #030712;
       --surface-hover: #111827;
       --on-surface: #f9fafb;
       
       --z-modal: 45;
       --z-modal-backdrop: 40;
       --z-modal-content: 46;
     }
     ```

3. **Component-Specific CSS Patterns**:
   - Use CSS modules for component-specific styles:
     ```css
     /* ProductCard.module.css */
     .card {
       @apply bg-surface rounded-xl overflow-hidden transition-shadow;
     }
     
     .card:hover {
       @apply shadow-xl;
     }
     
     .title {
       @apply text-lg font-medium text-on-surface truncate;
     }
     
     /* Different styles for different environments */
     [data-environment="merchant"] .card {
       @apply border border-gray-800;
     }
     
     [data-environment="storefront"] .card {
       @apply shadow-md;
     }
     ```

### Common Layout Patterns

1. **Page Structure**:
   ```html
   <!-- Standard Page Layout -->
   <div class="min-h-screen flex flex-col bg-surface text-on-surface">
     <!-- Header: Fixed height, sticky -->
     <header class="h-16 sticky top-0 z-30 bg-surface border-b border-gray-800 flex items-center px-4 sm:px-6">
       <!-- Header content -->
     </header>
     
     <!-- Main: Takes remaining space -->
     <main class="flex-1 py-8 px-4 sm:px-6 md:px-8">
       <!-- Page content -->
     </main>
     
     <!-- Footer: Fixed height -->
     <footer class="bg-gray-900 border-t border-gray-800 py-6 px-4 sm:px-6">
       <!-- Footer content -->
     </footer>
   </div>
   ```

2. **Card Patterns**:
   ```html
   <!-- Standard Card -->
   <div class="bg-surface border border-gray-800 rounded-xl overflow-hidden">
     <!-- Card Image (optional) -->
     <div class="aspect-w-16 aspect-h-9">
       <img src="..." alt="..." class="object-cover w-full h-full" />
     </div>
     
     <!-- Card Content -->
     <div class="p-4 sm:p-6">
       <h3 class="text-lg font-medium mb-2">Card Title</h3>
       <p class="text-gray-400">Card description goes here...</p>
     </div>
     
     <!-- Card Footer (optional) -->
     <div class="border-t border-gray-800 p-4 bg-gray-900 flex justify-between items-center">
       <span class="text-sm text-gray-400">Additional info</span>
       <button class="btn-primary">Action</button>
     </div>
   </div>
   ```

3. **Form Layout**:
   ```html
   <!-- Standard Form -->
   <form class="space-y-6 max-w-md mx-auto">
     <!-- Form Group -->
     <div class="space-y-2">
       <label for="email" class="block font-medium text-sm">Email</label>
       <input 
         type="email" 
         id="email" 
         class="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
       />
       <p class="text-sm text-red-500">Error message goes here</p>
     </div>
     
     <!-- Form Actions -->
     <div class="flex justify-end space-x-4 pt-4">
       <button type="button" class="btn-secondary">Cancel</button>
       <button type="submit" class="btn-primary">Submit</button>
     </div>
   </form>
   ```

4. **Table Pattern**:
   ```html
   <!-- Standard Table -->
   <div class="overflow-x-auto rounded-xl border border-gray-800">
     <table class="min-w-full divide-y divide-gray-800">
       <thead class="bg-gray-900">
         <tr>
           <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Name</th>
           <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Status</th>
           <th scope="col" class="px-6 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">Actions</th>
         </tr>
       </thead>
       <tbody class="bg-gray-900 divide-y divide-gray-800">
         <tr>
           <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">Product Name</td>
           <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-400">Active</td>
           <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
             <button class="text-primary hover:text-primary-hover">Edit</button>
           </td>
         </tr>
         <!-- More rows... -->
       </tbody>
     </table>
   </div>
   ```

### Responsive Design Patterns

1. **Container Pattern**:
   ```html
   <!-- Standard container with responsive padding -->
   <div class="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
     <!-- Content -->
   </div>
   ```

2. **Responsive Grid**:
   ```html
   <!-- Responsive grid using grid template -->
   <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
     <!-- Grid items -->
   </div>
   ```

3. **Responsive Typography**:
   ```html
   <!-- Responsive typography -->
   <h1 class="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold">Page Title</h1>
   <p class="text-base sm:text-lg">Description text that adapts to screen size</p>
   ```

4. **Stack-to-Row Pattern**:
   ```html
   <!-- Elements stack vertically on mobile, horizontally on larger screens -->
   <div class="flex flex-col sm:flex-row sm:space-x-4 space-y-4 sm:space-y-0">
     <!-- Items -->
   </div>
   ```

### Component Library Integration

1. **Base Component Extensions**:
   - Create base Tailwind components with @apply:
     ```css
     @layer components {
       .btn {
         @apply px-4 py-2 rounded-lg transition-colors font-medium focus:outline-none focus:ring-2;
       }
       
       .btn-primary {
         @apply btn bg-primary text-on-primary hover:bg-primary-hover focus:ring-primary/50;
       }
       
       .btn-secondary {
         @apply btn bg-surface text-on-surface border border-gray-700 hover:bg-surface-hover focus:ring-gray-500/50;
       }
       
       .input {
         @apply w-full px-4 py-2 bg-surface border border-gray-700 rounded-lg 
                focus:ring-2 focus:ring-primary focus:border-primary;
       }
     }
     ```

2. **Common Utility Class Combinations**:
   - Create a glossary of frequently used class combinations:
     ```
     # Card container
     bg-surface border border-gray-800 rounded-xl overflow-hidden

     # Subtle hover effect
     hover:bg-surface-hover transition-colors

     # Focus state
     focus:outline-none focus:ring-2 focus:ring-primary
     
     # Truncated text
     truncate text-ellipsis overflow-hidden whitespace-nowrap
     ```

### Animation Standards

1. **Transition Standards**:
   ```css
   /* Base transitions */
   .transition-fast {
     @apply transition-all duration-150 ease-in-out;
   }
   
   .transition-normal {
     @apply transition-all duration-300 ease-in-out;
   }
   
   /* Common animation patterns */
   .hover-lift {
     @apply transition-transform duration-300 ease-out;
   }
   
   .hover-lift:hover {
     @apply -translate-y-1;
   }
   ```

2. **Modal Animations**:
   ```css
   /* Modal entrance animation */
   .modal-enter {
     @apply opacity-0;
   }
   
   .modal-backdrop-enter {
     @apply opacity-0;
   }
   
   .modal-content-enter {
     @apply opacity-0 scale-95;
   }
   
   .modal-enter-active {
     @apply opacity-100 transition-opacity duration-300;
   }
   
   .modal-backdrop-enter-active {
     @apply opacity-100 transition-opacity duration-300;
   }
   
   .modal-content-enter-active {
     @apply opacity-100 scale-100 transition-all duration-300;
   }
   ```

### Best Practices for CSS Implementation

1. **Performance Optimization**:
   - Minimize render-blocking CSS
   - Use content-visibility for off-screen content
   - Implement responsive images with proper sizing
   - Use will-change property sparingly

2. **Accessibility Guidelines**:
   - Ensure color contrast ratios meet WCAG standards
   - Provide focus styles for keyboard navigation
   - Use semantic HTML elements with appropriate aria attributes
   - Test with screen readers and keyboard-only navigation

3. **CSS Debugging Tools**:
   - Implement utility classes for debugging:
     ```css
     .debug-layout {
       @apply outline outline-1 outline-red-500;
     }
     
     .debug-grid {
       background: linear-gradient(to bottom, rgba(255,0,0,0.1) 1px, transparent 1px);
       background-size: 100% 8px;
     }
     ```

4. **Documentation Standards**:
   - Document component variants with examples
   - Create a Storybook (or similar) catalog of UI components
   - Generate visual regression tests for critical UI components

By implementing these patterns consistently across both the merchant dashboard and storefront, we'll create a maintainable, performant, and consistent user experience while enabling developers to work efficiently within established patterns.

## Future Extensions

### Potential Improvements

1. **Modal Manager System**:
   - Centralized modal opening/closing
   - Global modal state management
   - Support for multiple simultaneous modals

2. **Animation Configuration**:
   - Environment-specific animations
   - Custom animation timing
   - Mobile-specific transitions

3. **Nested Modal Support**:
   - Proper stacking for modal-in-modal scenarios
   - Focus management between nested modals

4. **Mobile Optimizations**:
   - Slide-up sheet style for mobile devices
   - Gesture support (swipe to dismiss)
   - Better touch target sizing

## Migration Guide

For existing modal implementations:

1. Identify the current modal type
2. Map to the appropriate new component
3. Update props according to new API
4. Verify z-index and stacking behavior
5. Test in both desktop and mobile views

Example migration:

```tsx
// Before
<div className="fixed inset-0 z-50 overflow-y-auto">
  <div className="fixed inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
  <div className="relative min-h-screen flex items-center justify-center p-4">
    <div className="relative bg-gray-900 rounded-xl max-w-md w-full">
      <h2>Profile Settings</h2>
      {children}
    </div>
  </div>
</div>

// After
<Modal
  isOpen={true}
  onClose={onClose}
  title="Profile Settings"
>
  {children}
</Modal>
``` 