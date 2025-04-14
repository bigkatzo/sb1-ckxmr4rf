import { useParams, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useProduct } from '../hooks/useProduct';
import { ProductModal } from '../components/products/ProductModal';
import { createCategoryIndicesFromProducts } from '../utils/category-mapping';
import { ProductModalSkeleton } from '../components/ui/Skeletons';
import { useEffect, useState, useRef } from 'react';
import SEO from '../components/SEO';

export function ProductPage() {
  const { productSlug, collectionSlug } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { product, loading, error } = useProduct(collectionSlug, productSlug);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  
  // Keep track of the previous route to detect changes
  const prevRouteRef = useRef<string>('');
  const currentRoute = `${collectionSlug}/${productSlug}`;
  
  // Reset isInitialLoad when route parameters change or location changes
  useEffect(() => {
    // Check if the route has actually changed
    if (prevRouteRef.current !== currentRoute) {
      setIsInitialLoad(true);
      prevRouteRef.current = currentRoute;
    }
  }, [productSlug, collectionSlug, currentRoute, location.key]);
  
  // Track initial vs subsequent loads
  useEffect(() => {
    if (!loading && isInitialLoad) {
      setIsInitialLoad(false);
    }
  }, [loading, isInitialLoad]);
  
  // Get category index from location state or calculate it
  const categoryIndex = location.state?.categoryIndex ?? 
    (product ? createCategoryIndicesFromProducts([product])[product.categoryId] || 0 : 0);

  // Always show skeleton during loading, regardless of initial or subsequent load
  if (loading && !product) {
    return <ProductModalSkeleton />;
  }

  // Only redirect if we're not loading and there's an error or no product
  if (!loading && (error || !product)) {
    return <Navigate to={`/${collectionSlug}`} replace />;
  }

  // At this point we should have product data
  if (!product) {
    console.error('Product page rendered without product data');
    return <Navigate to={`/${collectionSlug}`} replace />;
  }

  // Ensure product has all required properties from location state
  const enrichedProduct = {
    ...product,
    ...location.state?.product,
    collectionSaleEnded: product.collectionSaleEnded ?? location.state?.product?.collectionSaleEnded
  };
  
  // Handle closing the product modal and returning to collection page
  const handleClose = () => {
    const scrollPosition = location.state?.scrollPosition;
    // Only pass the category if it was explicitly selected before
    const activeCategory = location.state?.selectedCategoryId;

    navigate(`/${collectionSlug}`, {
      replace: true, // Use replace to ensure back button works correctly
      state: {
        scrollPosition,
        // Only include selectedCategoryId if there was an active category
        ...(activeCategory && { selectedCategoryId: activeCategory }),
        returnedFromProduct: true
      }
    });
  };

  // Get product image for SEO
  const productImage = enrichedProduct.images?.[0]?.url || enrichedProduct.mainImage?.url || '';
  const productTitle = `${enrichedProduct.name} | ${enrichedProduct.collectionName || 'store.fun'}`;
  const productDescription = enrichedProduct.description || `${enrichedProduct.name} - Available at store.fun`;

  return (
    <>
      <SEO 
        title={productTitle}
        description={productDescription}
        image={productImage}
        productName={enrichedProduct.name}
        type="product"
      />
      <ProductModal
        product={enrichedProduct}
        onClose={handleClose}
        categoryIndex={categoryIndex}
        loading={loading} // Pass loading state to modal
      />
    </>
  );
}