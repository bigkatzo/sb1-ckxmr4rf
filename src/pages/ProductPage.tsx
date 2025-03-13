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

  return (
    <ProductModal
      product={enrichedProduct}
      onClose={handleClose}
      categoryIndex={categoryIndex}
    />
  );
}