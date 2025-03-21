import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { handleError, isValidId } from '../lib/error-handling';
import { normalizeStorageUrl } from '../lib/storage';
import type { Product } from '../types/variants';
import { toast } from 'react-toastify';

type ProductUpdate = Product | Product[] | ((prev: Product[]) => Product[]);

export function useProducts(collectionId?: string, categoryId?: string, isMerchant: boolean = false, deferLoad = false) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isMountedRef = useRef(true);
  const isFetchingRef = useRef(false);

  // Update product in state
  const updateProductInState = useCallback((updatedProduct: ProductUpdate) => {
    setProducts(prev => {
      if (typeof updatedProduct === 'function') {
        return updatedProduct(prev);
      }
      
      if (Array.isArray(updatedProduct)) {
        return updatedProduct;
      }

      return prev.map(product => 
        product.id === updatedProduct.id ? updatedProduct : product
      );
    });
  }, []);

  const fetchProducts = useCallback(async () => {
    if (!collectionId || isFetchingRef.current) return;
    isFetchingRef.current = true;

    setError(null);
    setProducts([]);

    if (!isValidId(collectionId) || (categoryId && !isValidId(categoryId))) {
      setError('Invalid identifier format');
      setLoading(false);
      isFetchingRef.current = false;
      return;
    }

    try {
      setLoading(true);

      let query = supabase
        .from(isMerchant ? 'merchant_products' : 'public_products_with_categories')
        .select('*')
        .eq('collection_id', collectionId)
        .order('id', { ascending: true });
      
      if (categoryId) {
        query = query.eq('category_id', categoryId);
      }

      const { data, error } = await query;

      if (error) throw error;
      
      const transformedProducts = (data || []).map(product => ({
        id: product.id,
        sku: product.sku,
        name: product.name,
        description: product.description,
        price: product.price,
        imageUrl: product.images?.[0] ? normalizeStorageUrl(product.images[0]) : '',
        images: (product.images || []).map((img: string) => normalizeStorageUrl(img)),
        categoryId: product.category_id,
        category: product.category_id && product.category_name ? {
          id: product.category_id,
          name: product.category_name,
          description: product.category_description,
          type: product.category_type,
          visible: true,
          eligibilityRules: {
            groups: product.category_eligibility_rules?.groups || []
          }
        } : undefined,
        collectionId: product.collection_id,
        collectionName: product.collection_name,
        collectionSlug: product.collection_slug,
        collectionLaunchDate: product.collection_launch_date ? new Date(product.collection_launch_date) : undefined,
        collectionSaleEnded: product.collection_sale_ended,
        slug: product.slug || '',
        stock: product.quantity,
        minimumOrderQuantity: product.minimum_order_quantity || 50,
        variants: product.variants || [],
        variantPrices: product.variant_prices || {},
        priceModifierBeforeMin: product.price_modifier_before_min ?? null,
        priceModifierAfterMin: product.price_modifier_after_min ?? null,
        visible: product.visible ?? true
      }));

      if (isMountedRef.current) {
        setProducts(transformedProducts);
        setError(null);
      }
    } catch (err) {
      console.error('Error fetching products:', err);
      const errorMessage = handleError(err);
      if (isMountedRef.current) {
        setError(errorMessage);
        toast.error(`Failed to load products: ${errorMessage}`);
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
      isFetchingRef.current = false;
    }
  }, [collectionId, categoryId, isMerchant]);

  useEffect(() => {
    if (!deferLoad) {
      fetchProducts();
    }

    return () => {
      isMountedRef.current = false;
    };
  }, [fetchProducts, deferLoad]);

  return { 
    products, 
    loading, 
    error,
    refreshProducts: fetchProducts,
    updateProductInState
  };
}