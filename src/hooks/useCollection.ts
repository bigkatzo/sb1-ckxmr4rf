import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { handleCollectionError } from '../utils/error-handlers';
import { isValidCollectionSlug } from '../utils/validation';
import { useCollectionCache } from '../contexts/CollectionContext';
import type { Category, Collection, Product } from '../types';
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

        const { data: collectionData, error: collectionError } = await supabase
          .from('collections')
          .select('*, sale_ended')
          .eq('slug', slug)
          .single();

        if (collectionError) throw collectionError;
        if (!collectionData) throw new Error('Collection not found');

        // Then fetch categories and products in parallel
        const [categoriesResponse, productsResponse] = await Promise.all([
          supabase
            .from('categories')
            .select('*, eligibility_rules')
            .eq('collection_id', collectionData.id),
          supabase
            .from('products')
            .select(`
              *,
              categories:category_id (
                id,
                name,
                description,
                type,
                eligibility_rules
              )
            `)
            .eq('collection_id', collectionData.id)
        ]);

        if (categoriesResponse.error) throw categoriesResponse.error;
        if (productsResponse.error) throw productsResponse.error;

        // Transform the data
        const transformedCollection: Collection = {
          id: collectionData.id,
          name: collectionData.name,
          description: collectionData.description,
          imageUrl: collectionData.image_url ? normalizeStorageUrl(collectionData.image_url) : '',
          launchDate: new Date(collectionData.launch_date),
          featured: collectionData.featured || false,
          visible: collectionData.visible,
          saleEnded: collectionData.sale_ended || false,
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
            category: product.categories ? {
              id: product.categories.id,
              name: product.categories.name,
              description: product.categories.description,
              type: product.categories.type,
              eligibilityRules: {
                rules: product.categories.eligibility_rules?.rules || []
              }
            } : undefined,
            collectionId: collectionData.id,
            collectionName: collectionData.name,
            collectionSlug: collectionData.slug,
            collectionLaunchDate: new Date(collectionData.launch_date),
            collectionSaleEnded: collectionData.sale_ended,
            slug: product.slug || '',
            stock: product.quantity || 0,
            minimumOrderQuantity: product.minimum_order_quantity || 50,
            variants: product.variants || [],
            variantPrices: product.variant_prices || {}
          }))
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