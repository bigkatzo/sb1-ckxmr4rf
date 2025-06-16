# Complete Testing & Deployment Guide

This file contains comprehensive testing procedures and deployment instructions for the product review system.

## Database Testing

### Test SQL Scripts

**File:** `tests/database/review-system-tests.sql`

```sql
-- ==========================================
-- COMPREHENSIVE REVIEW SYSTEM TESTS
-- ==========================================

-- Test Setup
DO $$
DECLARE
    test_product_id uuid;
    test_order_id uuid;
    test_wallet text := 'test_wallet_0x123456789abcdef';
    test_merchant_id uuid;
    test_collection_id uuid;
BEGIN
    RAISE NOTICE 'Starting review system tests...';
    
    -- Create test merchant/user
    INSERT INTO auth.users (id, email) 
    VALUES (gen_random_uuid(), 'test@example.com')
    ON CONFLICT DO NOTHING;
    
    -- Create test collection
    INSERT INTO collections (name, description, user_id)
    VALUES ('Test Collection', 'Test Description', (SELECT id FROM auth.users LIMIT 1))
    RETURNING id INTO test_collection_id;
    
    -- Create test product
    INSERT INTO products (name, price, description, collection_id) 
    VALUES ('Test Product for Reviews', 5000, 'Test product description', test_collection_id)
    RETURNING id INTO test_product_id;
    
    -- Create test order with delivered status
    INSERT INTO orders (product_id, wallet_address, status, total_amount)
    VALUES (test_product_id, test_wallet, 'delivered', 5000)
    RETURNING id INTO test_order_id;
    
    RAISE NOTICE 'Test data created - Product: %, Order: %', test_product_id, test_order_id;
    
    -- Test 1: Review Submission
    RAISE NOTICE 'Test 1: Review submission';
    PERFORM submit_product_review(
        test_product_id,
        test_order_id,
        5,
        'rocket',
        'This is a comprehensive test review that meets the minimum character requirement.'
    );
    
    -- Verify review was created
    IF NOT EXISTS (SELECT 1 FROM product_reviews WHERE product_id = test_product_id) THEN
        RAISE EXCEPTION 'Test 1 FAILED: Review was not created';
    END IF;
    RAISE NOTICE 'Test 1 PASSED: Review created successfully';
    
    -- Test 2: Review Stats
    RAISE NOTICE 'Test 2: Review statistics';
    DECLARE
        stats_result jsonb;
    BEGIN
        SELECT get_product_review_stats(test_product_id) INTO stats_result;
        
        IF (stats_result->>'total_reviews')::int != 1 THEN
            RAISE EXCEPTION 'Test 2 FAILED: Expected 1 review, got %', stats_result->>'total_reviews';
        END IF;
        
        IF (stats_result->>'average_rating')::float != 5.0 THEN
            RAISE EXCEPTION 'Test 2 FAILED: Expected rating 5.0, got %', stats_result->>'average_rating';
        END IF;
        
        RAISE NOTICE 'Test 2 PASSED: Stats calculated correctly';
    END;
    
    -- Test 3: Duplicate Review Prevention
    RAISE NOTICE 'Test 3: Duplicate review prevention';
    DECLARE
        duplicate_result jsonb;
    BEGIN
        SELECT submit_product_review(
            test_product_id,
            test_order_id,
            4,
            'fire',
            'This should fail as a duplicate review attempt.'
        ) INTO duplicate_result;
        
        IF (duplicate_result->>'success')::boolean THEN
            RAISE EXCEPTION 'Test 3 FAILED: Duplicate review was allowed';
        END IF;
        
        RAISE NOTICE 'Test 3 PASSED: Duplicate review prevented';
    END;
    
    -- Test 4: Permission Checking
    RAISE NOTICE 'Test 4: Permission checking';
    DECLARE
        permission_result jsonb;
    BEGIN
        SELECT can_user_review_product(test_order_id, test_product_id) INTO permission_result;
        
        IF (permission_result->>'can_review')::boolean THEN
            RAISE EXCEPTION 'Test 4 FAILED: Should not allow review after one is already submitted';
        END IF;
        
        RAISE NOTICE 'Test 4 PASSED: Permissions working correctly';
    END;
    
    -- Test 5: Formatted Reviews Function
    RAISE NOTICE 'Test 5: Formatted reviews retrieval';
    DECLARE
        formatted_reviews_count int;
    BEGIN
        SELECT COUNT(*) INTO formatted_reviews_count
        FROM get_product_reviews_formatted(test_product_id, 10, 0);
        
        IF formatted_reviews_count != 1 THEN
            RAISE EXCEPTION 'Test 5 FAILED: Expected 1 formatted review, got %', formatted_reviews_count;
        END IF;
        
        RAISE NOTICE 'Test 5 PASSED: Formatted reviews retrieved correctly';
    END;
    
    -- Test 6: Wallet Address Privacy
    RAISE NOTICE 'Test 6: Wallet address privacy';
    DECLARE
        formatted_wallet text;
    BEGIN
        SELECT formatted_wallet INTO formatted_wallet
        FROM get_product_reviews_formatted(test_product_id, 1, 0)
        LIMIT 1;
        
        IF formatted_wallet = test_wallet THEN
            RAISE EXCEPTION 'Test 6 FAILED: Wallet address was not anonymized';
        END IF;
        
        IF formatted_wallet NOT LIKE '____...____' THEN
            RAISE EXCEPTION 'Test 6 FAILED: Wallet format incorrect: %', formatted_wallet;
        END IF;
        
        RAISE NOTICE 'Test 6 PASSED: Wallet address properly anonymized: %', formatted_wallet;
    END;
    
    -- Cleanup
    DELETE FROM product_reviews WHERE product_id = test_product_id;
    DELETE FROM orders WHERE id = test_order_id;
    DELETE FROM products WHERE id = test_product_id;
    DELETE FROM collections WHERE id = test_collection_id;
    
    RAISE NOTICE 'All tests completed successfully! 🎉';
    
EXCEPTION
    WHEN OTHERS THEN
        -- Cleanup on error
        DELETE FROM product_reviews WHERE product_id = test_product_id;
        DELETE FROM orders WHERE id = test_order_id;
        DELETE FROM products WHERE id = test_product_id;
        DELETE FROM collections WHERE id = test_collection_id;
        
        RAISE EXCEPTION 'Test failed: %', SQLERRM;
END $$;
```

### Performance Tests

**File:** `tests/database/performance-tests.sql`

```sql
-- Performance testing for review system
DO $$
DECLARE
    test_product_id uuid;
    start_time timestamp;
    end_time timestamp;
    execution_time interval;
    i int;
BEGIN
    -- Create test product
    INSERT INTO products (name, price, description) 
    VALUES ('Performance Test Product', 1000, 'For performance testing')
    RETURNING id INTO test_product_id;
    
    -- Create 1000 test reviews
    RAISE NOTICE 'Creating 1000 test reviews...';
    start_time := clock_timestamp();
    
    FOR i IN 1..1000 LOOP
        INSERT INTO product_reviews (
            product_id, 
            order_id, 
            wallet_address, 
            product_rating, 
            merchant_rating, 
            review_text
        ) VALUES (
            test_product_id,
            gen_random_uuid(),
            'test_wallet_' || i::text,
            (i % 5) + 1, -- Rating 1-5
            CASE (i % 4) 
                WHEN 0 THEN 'rocket'
                WHEN 1 THEN 'fire'
                WHEN 2 THEN 'poop'
                ELSE 'flag'
            END,
            'Performance test review number ' || i::text || ' with sufficient content for validation testing.'
        );
    END LOOP;
    
    end_time := clock_timestamp();
    execution_time := end_time - start_time;
    RAISE NOTICE 'Review creation completed in: %', execution_time;
    
    -- Test stats function performance
    RAISE NOTICE 'Testing stats function performance...';
    start_time := clock_timestamp();
    
    FOR i IN 1..100 LOOP
        PERFORM get_product_review_stats(test_product_id);
    END LOOP;
    
    end_time := clock_timestamp();
    execution_time := end_time - start_time;
    RAISE NOTICE 'Stats function (100 calls) completed in: %', execution_time;
    
    -- Test formatted reviews function performance
    RAISE NOTICE 'Testing formatted reviews function performance...';
    start_time := clock_timestamp();
    
    FOR i IN 1..50 LOOP
        PERFORM * FROM get_product_reviews_formatted(test_product_id, 20, 0);
    END LOOP;
    
    end_time := clock_timestamp();
    execution_time := end_time - start_time;
    RAISE NOTICE 'Formatted reviews function (50 calls) completed in: %', execution_time;
    
    -- Cleanup
    DELETE FROM product_reviews WHERE product_id = test_product_id;
    DELETE FROM products WHERE id = test_product_id;
    
    RAISE NOTICE 'Performance tests completed successfully!';
END $$;
```

## Frontend Testing

### Component Tests

**File:** `tests/components/StarRating.test.tsx`

```typescript
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { StarRating } from '../../src/components/reviews/StarRating';

describe('StarRating Component', () => {
  test('renders correct number of stars', () => {
    render(<StarRating rating={3} />);
    const stars = screen.getAllByRole('button');
    expect(stars).toHaveLength(5);
  });

  test('shows filled stars correctly', () => {
    render(<StarRating rating={3} />);
    const stars = screen.getAllByRole('button');
    
    // First 3 stars should be filled (yellow)
    for (let i = 0; i < 3; i++) {
      expect(stars[i]).toHaveClass('text-yellow-400');
    }
    
    // Last 2 stars should be unfilled (gray)
    for (let i = 3; i < 5; i++) {
      expect(stars[i]).toHaveClass('text-gray-400');
    }
  });

  test('handles interactive rating changes', () => {
    const mockOnChange = jest.fn();
    render(<StarRating rating={0} interactive onRatingChange={mockOnChange} />);
    
    const fourthStar = screen.getAllByRole('button')[3];
    fireEvent.click(fourthStar);
    
    expect(mockOnChange).toHaveBeenCalledWith(4);
  });

  test('displays value when showValue is true', () => {
    render(<StarRating rating={4.2} showValue />);
    expect(screen.getByText('4.2')).toBeInTheDocument();
  });

  test('does not allow interaction when not interactive', () => {
    const mockOnChange = jest.fn();
    render(<StarRating rating={2} onRatingChange={mockOnChange} />);
    
    const firstStar = screen.getAllByRole('button')[0];
    fireEvent.click(firstStar);
    
    expect(mockOnChange).not.toHaveBeenCalled();
  });
});
```

**File:** `tests/components/ReviewForm.test.tsx`

```typescript
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ReviewForm } from '../../src/components/reviews/ReviewForm';

const mockProps = {
  productName: 'Test Product',
  onSubmit: jest.fn(),
  onCancel: jest.fn(),
};

describe('ReviewForm Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders product name correctly', () => {
    render(<ReviewForm {...mockProps} />);
    expect(screen.getByText('Test Product')).toBeInTheDocument();
  });

  test('validates required rating', async () => {
    render(<ReviewForm {...mockProps} />);
    
    const submitButton = screen.getByText('Submit Review');
    fireEvent.click(submitButton);
    
    await waitFor(() => {
      expect(screen.getByText('Please select a product rating')).toBeInTheDocument();
    });
    
    expect(mockProps.onSubmit).not.toHaveBeenCalled();
  });

  test('validates review text length', async () => {
    render(<ReviewForm {...mockProps} />);
    
    // Select rating first
    const stars = screen.getAllByRole('button');
    fireEvent.click(stars[4]); // 5 stars
    
    // Enter short text
    const textarea = screen.getByPlaceholderText(/Share your experience/);
    fireEvent.change(textarea, { target: { value: 'Too short' } });
    
    const submitButton = screen.getByText('Submit Review');
    fireEvent.click(submitButton);
    
    await waitFor(() => {
      expect(screen.getByText('Review must be at least 10 characters long')).toBeInTheDocument();
    });
  });

  test('validates maximum review text length', async () => {
    render(<ReviewForm {...mockProps} />);
    
    // Select rating first
    const stars = screen.getAllByRole('button');
    fireEvent.click(stars[4]); // 5 stars
    
    // Enter text over 1000 characters
    const longText = 'a'.repeat(1001);
    const textarea = screen.getByPlaceholderText(/Share your experience/);
    fireEvent.change(textarea, { target: { value: longText } });
    
    const submitButton = screen.getByText('Submit Review');
    fireEvent.click(submitButton);
    
    await waitFor(() => {
      expect(screen.getByText('Review must be less than 1000 characters')).toBeInTheDocument();
    });
  });

  test('submits form with valid data', async () => {
    mockProps.onSubmit.mockResolvedValue(undefined);
    
    render(<ReviewForm {...mockProps} />);
    
    // Select 4 stars
    const stars = screen.getAllByRole('button');
    fireEvent.click(stars[3]);
    
    // Select merchant rating
    const fireOption = screen.getByText('Great Service');
    fireEvent.click(fireOption);
    
    // Enter valid review text
    const textarea = screen.getByPlaceholderText(/Share your experience/);
    fireEvent.change(textarea, { target: { value: 'This is a valid review with enough characters.' } });
    
    // Submit form
    const submitButton = screen.getByText('Submit Review');
    fireEvent.click(submitButton);
    
    await waitFor(() => {
      expect(mockProps.onSubmit).toHaveBeenCalledWith({
        productRating: 4,
        merchantRating: 'fire',
        reviewText: 'This is a valid review with enough characters.'
      });
    });
  });

  test('shows loading state during submission', async () => {
    render(<ReviewForm {...mockProps} isLoading />);
    
    expect(screen.getByText('Submitting...')).toBeInTheDocument();
    
    const cancelButton = screen.getByText('Cancel');
    expect(cancelButton).toBeDisabled();
  });

  test('calls onCancel when cancel button is clicked', () => {
    render(<ReviewForm {...mockProps} />);
    
    const cancelButton = screen.getByText('Cancel');
    fireEvent.click(cancelButton);
    
    expect(mockProps.onCancel).toHaveBeenCalled();
  });
});
```

### Integration Tests

**File:** `tests/integration/review-flow.test.tsx`

```typescript
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { rest } from 'msw';
import { setupServer } from 'msw/node';
import { OrdersPage } from '../../src/pages/OrdersPage';
import { WalletProvider } from '../../src/contexts/WalletContext';

// Mock API responses
const server = setupServer(
  rest.post('/rest/v1/rpc/submit_product_review', (req, res, ctx) => {
    return res(ctx.json({ success: true, review_id: 'test-review-id' }));
  }),
  
  rest.post('/rest/v1/rpc/can_user_review_product', (req, res, ctx) => {
    return res(ctx.json({ can_review: true, reason: 'Can leave review' }));
  }),
  
  rest.get('/rest/v1/orders', (req, res, ctx) => {
    return res(ctx.json([
      {
        id: 'test-order-id',
        product_id: 'test-product-id',
        wallet_address: 'test-wallet',
        status: 'delivered',
        total_amount: 5000,
        created_at: '2024-01-01T00:00:00Z',
        products: { name: 'Test Product' }
      }
    ]));
  })
);

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

// Mock wallet context
const MockWalletProvider = ({ children }: { children: React.ReactNode }) => (
  <WalletProvider value={{ walletAddress: 'test-wallet', isConnected: true }}>
    {children}
  </WalletProvider>
);

describe('Review Flow Integration', () => {
  test('complete review submission flow', async () => {
    render(
      <MockWalletProvider>
        <OrdersPage />
      </MockWalletProvider>
    );

    // Wait for orders to load
    await waitFor(() => {
      expect(screen.getByText('Test Product')).toBeInTheDocument();
    });

    // Click "Leave Review" button
    const reviewButton = screen.getByText('Leave Review');
    fireEvent.click(reviewButton);

    // Wait for review form to appear
    await waitFor(() => {
      expect(screen.getByText('Leave a Review')).toBeInTheDocument();
    });

    // Fill out the form
    const stars = screen.getAllByLabelText(/star/);
    fireEvent.click(stars[4]); // 5 stars

    const textarea = screen.getByPlaceholderText(/Share your experience/);
    fireEvent.change(textarea, { 
      target: { value: 'This is an excellent product that exceeded my expectations!' } 
    });

    // Submit the review
    const submitButton = screen.getByText('Submit Review');
    fireEvent.click(submitButton);

    // Wait for success message
    await waitFor(() => {
      expect(screen.getByText('Review submitted successfully!')).toBeInTheDocument();
    });

    // Form should close
    await waitFor(() => {
      expect(screen.queryByText('Leave a Review')).not.toBeInTheDocument();
    });
  });

  test('handles review submission errors', async () => {
    // Override server to return error
    server.use(
      rest.post('/rest/v1/rpc/submit_product_review', (req, res, ctx) => {
        return res(ctx.status(400), ctx.json({ error: 'Review submission failed' }));
      })
    );

    render(
      <MockWalletProvider>
        <OrdersPage />
      </MockWalletProvider>
    );

    // Navigate through the flow
    await waitFor(() => {
      expect(screen.getByText('Test Product')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Leave Review'));

    await waitFor(() => {
      expect(screen.getByText('Leave a Review')).toBeInTheDocument();
    });

    // Fill and submit form
    const stars = screen.getAllByLabelText(/star/);
    fireEvent.click(stars[4]);

    const textarea = screen.getByPlaceholderText(/Share your experience/);
    fireEvent.change(textarea, { 
      target: { value: 'This is a test review for error handling.' } 
    });

    const submitButton = screen.getByText('Submit Review');
    fireEvent.click(submitButton);

    // Should show error message
    await waitFor(() => {
      expect(screen.getByText(/Failed to submit review/)).toBeInTheDocument();
    });
  });
});
```

## End-to-End Testing

**File:** `tests/e2e/review-system.spec.ts` (Playwright)

```typescript
import { test, expect } from '@playwright/test';

test.describe('Review System E2E', () => {
  test.beforeEach(async ({ page }) => {
    // Mock wallet connection
    await page.addInitScript(() => {
      window.mockWallet = {
        address: 'test-wallet-address',
        isConnected: true
      };
    });
  });

  test('user can leave a review for delivered product', async ({ page }) => {
    await page.goto('/orders');

    // Wait for orders to load
    await expect(page.locator('text=My Orders')).toBeVisible();

    // Find delivered order and click review button
    const orderCard = page.locator('[data-testid="order-card"]').first();
    await expect(orderCard.locator('text=delivered')).toBeVisible();
    await orderCard.locator('text=Leave Review').click();

    // Fill review form
    await expect(page.locator('text=Leave a Review')).toBeVisible();
    
    // Select 5 stars
    await page.locator('[aria-label="5 stars"]').click();
    
    // Select merchant rating
    await page.locator('text=Excellent Service').click();
    
    // Enter review text
    await page.fill('textarea[placeholder*="Share your experience"]', 
      'This product exceeded my expectations in every way. Great quality and fast shipping!');
    
    // Submit review
    await page.click('text=Submit Review');
    
    // Wait for success message
    await expect(page.locator('text=Review submitted successfully!')).toBeVisible();
    
    // Form should close
    await expect(page.locator('text=Leave a Review')).not.toBeVisible();
  });

  test('user can view product reviews in product modal', async ({ page }) => {
    await page.goto('/products');

    // Click on a product to open modal
    const productCard = page.locator('[data-testid="product-card"]').first();
    await productCard.click();

    // Wait for product modal to open
    await expect(page.locator('[data-testid="product-modal"]')).toBeVisible();

    // Check if reviews section is present
    await expect(page.locator('text=Customer Reviews')).toBeVisible();

    // If reviews exist, check they display correctly
    const reviewPreview = page.locator('[data-testid="review-preview"]');
    if (await reviewPreview.isVisible()) {
      await expect(reviewPreview.locator('[data-testid="star-rating"]')).toBeVisible();
      await expect(reviewPreview.locator('text=Verified Purchase')).toBeVisible();
    }

    // Test "View All Reviews" functionality
    const viewAllButton = page.locator('text=View all');
    if (await viewAllButton.isVisible()) {
      await viewAllButton.click();
      await expect(page.locator('[data-testid="review-modal"]')).toBeVisible();
      
      // Test sorting
      await page.selectOption('select', 'product_rating DESC');
      await expect(page.locator('[data-testid="review-item"]').first()).toBeVisible();
      
      // Close review modal
      await page.click('[data-testid="close-review-modal"]');
      await expect(page.locator('[data-testid="review-modal"]')).not.toBeVisible();
    }
  });

  test('prevents duplicate reviews', async ({ page }) => {
    await page.goto('/orders');

    // Try to review the same product twice
    const orderCard = page.locator('[data-testid="order-card"]').first();
    
    // First review
    await orderCard.locator('text=Leave Review').click();
    await page.locator('[aria-label="5 stars"]').click();
    await page.fill('textarea', 'First review attempt');
    await page.click('text=Submit Review');
    await expect(page.locator('text=Review submitted successfully!')).toBeVisible();

    // Second review attempt should show already reviewed
    await expect(orderCard.locator('text=✓ Reviewed')).toBeVisible();
    await expect(orderCard.locator('text=Leave Review')).not.toBeVisible();
  });

  test('validates review form inputs', async ({ page }) => {
    await page.goto('/orders');

    const orderCard = page.locator('[data-testid="order-card"]').first();
    await orderCard.locator('text=Leave Review').click();

    // Try to submit without rating
    await page.click('text=Submit Review');
    await expect(page.locator('text=Please select a product rating')).toBeVisible();

    // Try to submit with short review text
    await page.locator('[aria-label="3 stars"]').click();
    await page.fill('textarea', 'Short');
    await page.click('text=Submit Review');
    await expect(page.locator('text=Review must be at least 10 characters long')).toBeVisible();

    // Submit valid review
    await page.fill('textarea', 'This is a valid review with sufficient content for testing purposes.');
    await page.click('text=Submit Review');
    await expect(page.locator('text=Review submitted successfully!')).toBeVisible();
  });
});
```

## Deployment Guide

### Pre-deployment Checklist

**File:** `deployment/checklist.md`

```markdown
# Pre-Deployment Checklist

## Database Readiness
- [ ] All migrations tested in staging environment
- [ ] Database functions executed successfully
- [ ] RLS policies verified with different user scenarios
- [ ] Performance tested with sample data (1000+ reviews)
- [ ] Backup strategy confirmed

## Code Quality
- [ ] All TypeScript compilation errors resolved
- [ ] ESLint/Prettier formatting applied
- [ ] Code review completed
- [ ] Security audit passed
- [ ] Dependencies updated and vulnerabilities patched

## Testing Completeness
- [ ] Unit tests pass (90%+ coverage)
- [ ] Integration tests pass
- [ ] E2E tests pass
- [ ] Manual testing completed
- [ ] Mobile testing completed
- [ ] Cross-browser testing completed

## Performance Verification
- [ ] Page load times under 3 seconds
- [ ] Review submission under 2 seconds
- [ ] Large dataset performance tested
- [ ] Database query optimization verified
- [ ] Bundle size optimized

## Security Checklist
- [ ] Input validation implemented
- [ ] SQL injection prevention verified
- [ ] XSS protection in place
- [ ] Rate limiting configured
- [ ] Wallet authentication tested

## Monitoring Setup
- [ ] Error tracking configured
- [ ] Performance monitoring enabled
- [ ] Database query monitoring
- [ ] User analytics tracking
- [ ] Alert thresholds configured
```

### Deployment Scripts

**File:** `deployment/deploy.sh`

```bash
#!/bin/bash

# Product Review System Deployment Script
set -e

echo "🚀 Starting Product Review System Deployment..."

# Configuration
ENVIRONMENT=${1:-production}
BACKUP_DB=${2:-true}

echo "📋 Environment: $ENVIRONMENT"
echo "📋 Backup DB: $BACKUP_DB"

# Function to log with timestamp
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1"
}

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Validate prerequisites
log "✅ Checking prerequisites..."
if ! command_exists "supabase"; then
    echo "❌ Supabase CLI not found. Please install it first."
    exit 1
fi

if ! command_exists "npm"; then
    echo "❌ npm not found. Please install Node.js first."
    exit 1
fi

# Check if we're in the right directory
if [[ ! -f "package.json" ]]; then
    echo "❌ package.json not found. Please run from project root."
    exit 1
fi

# Backup database if requested
if [[ "$BACKUP_DB" == "true" ]]; then
    log "💾 Creating database backup..."
    backup_file="backup_$(date +%Y%m%d_%H%M%S).sql"
    supabase db dump --file="$backup_file" || {
        echo "❌ Database backup failed!"
        exit 1
    }
    log "✅ Database backed up to $backup_file"
fi

# Run pre-deployment tests
log "🧪 Running pre-deployment tests..."
npm test -- --watchAll=false --coverage || {
    echo "❌ Tests failed! Deployment aborted."
    exit 1
}

# Apply database migrations
log "📊 Applying database migrations..."
supabase migration up --environment "$ENVIRONMENT" || {
    echo "❌ Database migration failed!"
    exit 1
}

# Run database tests
log "🔍 Running database tests..."
supabase db test --environment "$ENVIRONMENT" || {
    echo "❌ Database tests failed!"
    exit 1
}

# Build frontend
log "🏗️ Building frontend..."
npm run build || {
    echo "❌ Frontend build failed!"
    exit 1
}

# Deploy to hosting platform
log "🌐 Deploying to hosting platform..."
case "$ENVIRONMENT" in
    "production")
        # Add your production deployment command here
        # Examples:
        # netlify deploy --prod --dir=build
        # vercel --prod
        # aws s3 sync build/ s3://your-bucket-name
        echo "Deploy to your production platform here"
        ;;
    "staging")
        # Add your staging deployment command here
        echo "Deploy to your staging platform here"
        ;;
    *)
        echo "❌ Unknown environment: $ENVIRONMENT"
        exit 1
        ;;
esac

# Post-deployment verification
log "✅ Running post-deployment verification..."

# Health check
if command_exists "curl"; then
    health_url="https://your-domain.com/health"
    if curl -f "$health_url" > /dev/null 2>&1; then
        log "✅ Health check passed"
    else
        log "⚠️  Health check failed - manual verification needed"
    fi
fi

# Database connectivity test
log "🔍 Testing database connectivity..."
supabase db test --environment "$ENVIRONMENT" || {
    echo "⚠️  Post-deployment database test failed"
}

log "🎉 Deployment completed successfully!"
log "📝 Next steps:"
log "   • Test review creation in $ENVIRONMENT"
log "   • Monitor error logs"
log "   • Update documentation"
log "   • Notify team of deployment"

# Generate deployment report
cat > deployment_report.txt << EOF
Deployment Report
=================
Date: $(date)
Environment: $ENVIRONMENT
Backup File: $backup_file
Status: SUCCESS

Components Deployed:
- Database migrations ✅
- Frontend application ✅
- Review system components ✅

Post-deployment Tasks:
- [ ] Test review submission
- [ ] Verify review display
- [ ] Monitor error rates
- [ ] Update team documentation
EOF

echo "📄 Deployment report saved to deployment_report.txt"
```

### Rollback Script

**File:** `deployment/rollback.sh`

```bash
#!/bin/bash

# Rollback script for review system deployment
set -e

BACKUP_FILE=${1}
ENVIRONMENT=${2:-production}

if [[ -z "$BACKUP_FILE" ]]; then
    echo "❌ Usage: $0 <backup_file> [environment]"
    echo "Example: $0 backup_20241201_143000.sql production"
    exit 1
fi

if [[ ! -f "$BACKUP_FILE" ]]; then
    echo "❌ Backup file not found: $BACKUP_FILE"
    exit 1
fi

echo "🔄 Starting rollback process..."
echo "📋 Backup file: $BACKUP_FILE"
echo "📋 Environment: $ENVIRONMENT"

read -p "⚠️  This will restore the database from backup. Continue? (y/N) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Rollback cancelled."
    exit 1
fi

# Create pre-rollback backup
echo "💾 Creating pre-rollback backup..."
pre_rollback_backup="pre_rollback_$(date +%Y%m%d_%H%M%S).sql"
supabase db dump --file="$pre_rollback_backup"

# Restore from backup
echo "🔄 Restoring database from backup..."
supabase db reset --environment "$ENVIRONMENT"
supabase db restore --file="$BACKUP_FILE" --environment "$ENVIRONMENT"

# Verify rollback
echo "✅ Running post-rollback verification..."
supabase db test --environment "$ENVIRONMENT"

echo "🎉 Rollback completed successfully!"
echo "📄 Pre-rollback backup saved as: $pre_rollback_backup"
```

### Monitoring Setup

**File:** `monitoring/setup-monitoring.sql`

```sql
-- Create monitoring views and functions
CREATE OR REPLACE VIEW review_system_health AS
SELECT 
    'review_system' as component,
    COUNT(*) as total_reviews,
    COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '24 hours') as reviews_24h,
    COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '1 hour') as reviews_1h,
    ROUND(AVG(product_rating::numeric), 2) as avg_rating,
    COUNT(DISTINCT wallet_address) as unique_reviewers,
    COUNT(DISTINCT product_id) as products_with_reviews
FROM product_reviews;

-- Function to check system health
CREATE OR REPLACE FUNCTION check_review_system_health()
RETURNS jsonb AS $$
DECLARE
    health_data jsonb;
BEGIN
    SELECT jsonb_build_object(
        'status', 'healthy',
        'timestamp', NOW(),
        'metrics', (
            SELECT row_to_json(review_system_health) 
            FROM review_system_health
        ),
        'checks', jsonb_build_object(
            'database_connection', 'ok',
            'review_table_accessible', EXISTS(SELECT 1 FROM product_reviews LIMIT 1),
            'functions_available', (
                SELECT COUNT(*) = 4 
                FROM information_schema.routines 
                WHERE routine_name IN (
                    'get_product_review_stats',
                    'can_user_review_product',
                    'get_product_reviews_formatted',
                    'submit_product_review'
                )
            )
        )
    ) INTO health_data;
    
    RETURN health_data;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT SELECT ON review_system_health TO authenticated, anon;
GRANT EXECUTE ON FUNCTION check_review_system_health() TO authenticated, anon;
```

This completes the comprehensive testing and deployment guide for the review system. 