import { useParams, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useProduct } from '../hooks/useProduct';
import { ProductModal } from '../components/products/ProductModal';
import { createCategoryIndicesFromProducts } from '../utils/category-mapping';
import { ProductModalSkeleton } from '../components/ui/Skeletons';

export function ProductPage() {
  const { productSlug, collectionSlug } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { product, loading, error } = useProduct(collectionSlug, productSlug);
  
  // Get category index from location state or calculate it
  const categoryIndex = location.state?.categoryIndex ?? 
    (product ? createCategoryIndicesFromProducts([product])[product.categoryId] || 0 : 0);
    
  // Get the selected category ID from location state
  const selectedCategoryId = location.state?.selectedCategoryId;

  if (loading) {
    return <ProductModalSkeleton />;
  }

  if (error || !product) {
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
    // Get scroll position from location state
    const scrollPosition = location.state?.scrollPosition;
    
    // Navigate back to collection with selected category in state
    if (selectedCategoryId) {
      navigate(`/${collectionSlug}`, { 
        replace: true,
        state: { 
          selectedCategoryId,
          scrollPosition
        }
      });
    } else {
      // Otherwise just go back
      window.history.back();
    }
  };

  return (
    <ProductModal
      product={enrichedProduct}
      onClose={handleClose}
      categoryIndex={categoryIndex}
    />
  );
}