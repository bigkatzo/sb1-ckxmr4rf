import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { handleError } from '../lib/error-handling';
import { normalizeStorageUrl } from '../lib/storage';
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
          .from('public_products')
          .select('*')
          .eq('collection_slug', collectionSlug)
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
          imageUrl: data.images?.[0] ? normalizeStorageUrl(data.images[0]) : '',
          images: (data.images || []).map((img: string) => normalizeStorageUrl(img)),
          categoryId: data.category_id,
          collectionId: data.collection_id,
          collectionName: data.collection_name,
          collectionSlug: data.collection_slug,
          collectionLaunchDate: data.collection_launch_date ? new Date(data.collection_launch_date) : undefined,
          collectionSaleEnded: data.collection_sale_ended,
          slug: data.slug,
          stock: data.quantity,
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