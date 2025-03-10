import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { handleCollectionError } from '../utils/error-handlers';
import { isValidCollectionSlug } from '../utils/validation';
import { useCollectionCache } from '../contexts/CollectionContext';
import type { Collection } from '../types';
import { normalizeStorageUrl } from '../lib/storage';

export function useCollection(slug: string) {
  const [collection, setCollection] = useState<Collection | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { cachedCollection, setCachedCollection } = useCollectionCache();

  useEffect(() => {
    async function fetchCollection() {
      if (!slug || !isValidCollectionSlug(slug)) {
        setError('Invalid collection URL');
        setLoading(false);
        return;
      }

      // Use cached collection if available and matches current slug
      if (cachedCollection && cachedCollection.slug === slug) {
        setCollection(cachedCollection);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        // Fetch collection from public view
        const { data: collectionData, error: collectionError } = await supabase
          .from('public_collections')
          .select('*')
          .eq('slug', slug)
          .single();

        if (collectionError) throw collectionError;
        if (!collectionData) throw new Error('Collection not found');

        // Then fetch categories and products in parallel from public views
        const [categoriesResponse, productsResponse] = await Promise.all([
          supabase
            .from('public_categories')
            .select('*')
            .eq('collection_id', collectionData.id),
          supabase
            .from('public_products_with_categories')
            .select('*')
            .eq('collection_id', collectionData.id)
        ]);

        if (categoriesResponse.error) throw categoriesResponse.error;
        if (productsResponse.error) throw productsResponse.error;

        const transformedCollection: Collection = {
          id: collectionData.id,
          name: collectionData.name,
          description: collectionData.description,
          imageUrl: collectionData.image_url ? normalizeStorageUrl(collectionData.image_url) : '',
          launchDate: new Date(collectionData.launch_date),
          featured: collectionData.featured,
          visible: collectionData.visible,
          saleEnded: collectionData.sale_ended,
          slug: collectionData.slug,
          categories: (categoriesResponse.data || []).map(category => ({
            id: category.id,
            name: category.name,
            description: category.description,
            type: category.type,
            eligibilityRules: {
              rules: category.eligibility_rules?.rules || []
            }
          })),
          products: (productsResponse.data || []).map(product => ({
            id: product.id,
            sku: product.sku,
            name: product.name,
            description: product.description,
            price: product.price,
            imageUrl: product.images?.[0] ? normalizeStorageUrl(product.images[0]) : '',
            images: (product.images || []).map((img: string) => normalizeStorageUrl(img)),
            categoryId: product.category_id,
            category: product.category_id ? {
              id: product.category_id,
              name: product.category_name,
              description: product.category_description,
              type: product.category_type,
              eligibilityRules: {
                rules: product.category_eligibility_rules?.rules || []
              }
            } : undefined,
            collectionId: collectionData.id,
            collectionName: collectionData.name,
            collectionSlug: collectionData.slug,
            collectionLaunchDate: new Date(collectionData.launch_date),
            collectionSaleEnded: collectionData.sale_ended,
            slug: product.slug || '',
            stock: product.quantity,
            minimumOrderQuantity: product.minimum_order_quantity || 50,
            variants: product.variants || [],
            variantPrices: product.variant_prices || {}
          })),
          accessType: null // Public collections don't have access type
        };

        setCollection(transformedCollection);
        setCachedCollection(transformedCollection);
        setError(null);
      } catch (err) {
        console.error('Error fetching collection:', err);
        setError(handleCollectionError(err));
        setCollection(null);
      } finally {
        setLoading(false);
      }
    }

    fetchCollection();
  }, [slug, cachedCollection, setCachedCollection]);

  return { collection, loading, error };
}