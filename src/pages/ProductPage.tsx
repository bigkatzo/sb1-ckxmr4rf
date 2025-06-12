import { useParams, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useProduct } from '../hooks/useProduct';
import { ProductModal } from '../components/products/ProductModal';
import { createCategoryIndicesFromProducts } from '../utils/category-mapping';
import { ProductModalSkeleton } from '../components/ui/Skeletons';
import { useEffect, useState, useRef } from 'react';
import SEO from '../components/SEO';
import { preloadPageResources, prefetchGallery } from '../lib/service-worker';
import { createPortal } from 'react-dom';
import { clearPreviewCache } from '../utils/preview';

export function ProductPage() {
  const { productSlug, collectionSlug } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { product, loading, error } = useProduct(collectionSlug, productSlug);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  
  // Keep track of the previous route to detect changes
  const prevRouteRef = useRef<string>('');
  const currentRoute = `${collectionSlug}/${productSlug}`;
  
  // Immediately preload possible LCP image from URL params before product data loads
  useEffect(() => {
    if (collectionSlug && productSlug) {
      // Direct preload attempt based on URL pattern even before product data loads
      const possibleImageUrl = `https://sakysysfksculqobozxi.supabase.co/storage/v1/render/image/public/product-images/${productSlug}?width=640&quality=80&format=webp`;
      
      // Create link element for preload
      const link = document.createElement('link');
      link.rel = 'preload';
      link.as = 'image';
      link.href = possibleImageUrl;
      link.fetchPriority = 'high';
      link.crossOrigin = 'anonymous';
      
      // Insert at start of head for maximum priority
      document.head.insertBefore(link, document.head.firstChild);
      
      // Also create an image element to ensure load
      const img = new Image();
      img.src = possibleImageUrl;
      img.fetchPriority = 'high';
      img.crossOrigin = 'anonymous';
    }
  }, [collectionSlug, productSlug]);
  
  // Preload resources for product page
  useEffect(() => {
    if (collectionSlug && productSlug) {
      // Tell service worker to preload product-related resources
      preloadPageResources('product', productSlug);
      
      // Preload main product image if available
      if (product && product.images && product.images.length > 0 && product.images[0]) {
        const img = new Image();
        img.src = product.images[0];
        img.fetchPriority = 'high';
        img.crossOrigin = 'anonymous';
        
        // Preload a few more product images to prepare for carousel
        if (product.images.length > 1) {
          // Initialize intelligent gallery prefetching for the entire image set
          prefetchGallery(productSlug, [...product.images], 0);
          
          // Also explicitly load the second image with high priority
          const secondImg = new Image();
          secondImg.src = product.images[1];
          secondImg.fetchPriority = 'high';
          secondImg.crossOrigin = 'anonymous';
          
          // If there are more images, preload the third with lower priority 
          if (product.images.length >= 3) {
            const thirdImgLink = document.createElement('link');
            thirdImgLink.rel = 'preload';
            thirdImgLink.as = 'image';
            thirdImgLink.href = product.images[2];
            thirdImgLink.fetchPriority = 'low';
            thirdImgLink.crossOrigin = 'anonymous';
            document.head.appendChild(thirdImgLink);
            
            // Clean up preload link after a timeout
            setTimeout(() => {
              if (document.head.contains(thirdImgLink)) {
                document.head.removeChild(thirdImgLink);
              }
            }, 3000);
          }
        }
      }
    }
  }, [collectionSlug, productSlug, product]);
  
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
  const handleClose = async () => {
    const scrollPosition = location.state?.scrollPosition;
    // Only pass the category if it was explicitly selected before
    const activeCategory = location.state?.selectedCategoryId;
    
    // Check if preview mode is being turned off
    const searchParams = new URLSearchParams(window.location.search);
    const hasPreview = searchParams.has('preview');
    const newSearchParams = new URLSearchParams(window.location.search);
    
    // If preview parameter is being removed, we need to force a page reload
    // to ensure the collection page properly resets its state
    if (hasPreview && !newSearchParams.has('preview')) {
      // Clear preview cache before redirecting
      await clearPreviewCache();
      const baseUrl = `/${collectionSlug}`;
      window.location.href = baseUrl;
      return;
    }

    // Otherwise proceed with normal navigation
    const collectionUrl = `/${collectionSlug}${hasPreview ? '?preview' : ''}`;
    navigate(collectionUrl, {
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

  // Render the modal using a portal at the root level, just like in BestSellers
  const renderProductModal = () => {
    if (!enrichedProduct) return null;
    
    return createPortal(
      <ProductModal
        product={enrichedProduct}
        onClose={handleClose}
        categoryIndex={categoryIndex}
        loading={loading} // Pass loading state to modal
      />,
      document.body // Render directly to the body just like BestSellers does
    );
  };

  return (
    <>
      <SEO 
        title={productTitle}
        description={productDescription}
        image={productImage}
        productName={enrichedProduct.name}
        type="product"
        product={enrichedProduct}
      />
      {renderProductModal()}
    </>
  );
}