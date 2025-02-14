import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { handleError } from '../lib/error-handling';
import { transformProduct } from '../lib/realtime/transformers';
import type { Product } from '../types';

export function useProduct(collectionSlug?: string, productSlug?: string) {
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchProduct() {
      if (!collectionSlug || !productSlug) return;

      try {
        const { data, error } = await supabase
          .from('products')
          .select(`
            *,
            categories:category_id (*),
            collections:collection_id (
              id,
              name,
              slug,
              launch_date,
              sale_ended
            )
          `)
          .eq('collections.slug', collectionSlug)
          .eq('slug', productSlug)
          .single();

        if (error) throw error;
        if (!data) throw new Error('Product not found');

        const transformedProduct: Product = {
          id: data.id,
          sku: data.sku,
          name: data.name,
          description: data.description,
          price: data.price,
          imageUrl: data.images?.[0] || '',
          images: data.images || [],
          categoryId: data.category_id,
          category: data.categories ? {
            id: data.categories.id,
            name: data.categories.name,
            description: data.categories.description,
            type: data.categories.type,
            eligibilityRules: {
              rules: data.categories.eligibility_rules?.rules || []
            }
          } : undefined,
          collectionId: data.collection_id,
          collectionName: data.collections?.name,
          collectionSlug: data.collections?.slug,
          collectionLaunchDate: data.collections?.launch_date ? new Date(data.collections.launch_date) : undefined,
          collectionSaleEnded: data.collections?.sale_ended,
          slug: data.slug,
          stock: data.quantity || 0,
          minimumOrderQuantity: data.minimum_order_quantity || 50,
          variants: data.variants || [],
          variantPrices: data.variant_prices || {}
        };

        setProduct(transformedProduct);
        setError(null);
      } catch (err) {
        console.error('Error fetching product:', err);
        setError(handleError(err));
      } finally {
        setLoading(false);
      }
    }

    fetchProduct();
  }, [collectionSlug, productSlug]);

  return { product, loading, error };
}