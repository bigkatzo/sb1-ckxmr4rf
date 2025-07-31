import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { handleError, isValidId } from '../lib/error-handling';
import { normalizeStorageUrl } from '../lib/storage';
import { cacheManager, CACHE_DURATIONS } from '../lib/cache';
import type { Product } from '../types/variants';

// Get Supabase URL and key from environment variables
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Cache key for products
const getProductsCacheKey = (collectionId?: string, categoryId?: string) => 
  `merchant_products:${collectionId || 'all'}:${categoryId || 'all'}`;

type ProductFilters = {
  categoryId?: string;
  collectionId?: string;
};

export function useProducts(filters: ProductFilters = {}, isMerchant: boolean = true) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isMountedRef = useRef(true);
  const isFetchingRef = useRef(false);

  const { collectionId, categoryId } = filters;

  const fetchProducts = useCallback(async (isRefresh = false) => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;
    
    if (!isRefresh) {
      setError(null);
      setLoading(true);
    }
    
    setProducts([]);

    if (!collectionId) {
      setLoading(false);
      isFetchingRef.current = false;
      return;
    }

    if (!isValidId(collectionId) || (categoryId && !isValidId(categoryId))) {
      setError('Invalid identifier format');
      setLoading(false);
      isFetchingRef.current = false;
      return;
    }

    // Cache key for this query
    const cacheKey = getProductsCacheKey(collectionId, categoryId);

    try {
      // Check cache first if not explicitly refreshing
      if (!isRefresh) {
        const { value: cachedProducts, needsRevalidation } = await cacheManager.get<Product[]>(cacheKey);
        
        if (cachedProducts) {
          if (isMountedRef.current) {
            setProducts(cachedProducts);
            setLoading(false);
          }
          
          // If data is still fresh, return early
          if (!needsRevalidation) {
            isFetchingRef.current = false;
            return;
          }
          // Otherwise continue with the fetch in the background
        }
      }

      // Build query
      let query = supabase
        .from('merchant_products')
        .select('*');

      // Apply filters
      query = query.eq('collection_id', collectionId);
      if (categoryId) {
        query = query.eq('category_id', categoryId);
      }

      // Only include visible products for non-merchant users
      if (!isMerchant) {
        query = query.eq('visible', true);
      }

      // Execute query with better error handling
      let result;
      try {
        result = await query.order('id', { ascending: false });
      } catch (initialError) {
        console.error('Initial query error:', initialError);
        
        // If it's likely a 400 error, try a direct fetch with fixed URL formatting
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (!session) throw new Error('No authentication session');
          
          // Build a proper URL manually
          const url = `${SUPABASE_URL}/rest/v1/merchant_products?select=*&collection_id=eq.${collectionId}${categoryId ? `&category_id=eq.${categoryId}` : ''}&order=id.desc`;
          
          const response = await fetch(url, {
            headers: {
              'apikey': SUPABASE_KEY,
              'Authorization': `Bearer ${session.access_token}`,
              'Content-Type': 'application/json'
            }
          });
          
          if (!response.ok) throw new Error(`API request failed: ${response.status}`);
          
          const data = await response.json();
          result = { data, error: null };
        } catch (fallbackError) {
          console.error('Fallback query error:', fallbackError);
          throw initialError; // Re-throw the original error if fallback fails
        }
      }

      const { data, error } = result;
      if (error) throw error;

      // Transform the data
      const transformedProducts = data?.map((product: any) => {
        // Handle notes properly - check if notes is a valid object with properties
        let notesObject: Record<string, string> = {};
        let freeNotesValue = '';
        
        try {
          if (product.notes && typeof product.notes === 'object') {
            notesObject = product.notes;
          } else if (product.notes && typeof product.notes === 'string') {
            try {
              notesObject = JSON.parse(product.notes);
            } catch (e) {
              // If it can't be parsed as JSON, store it as free notes
              freeNotesValue = product.notes;
            }
          }
          
          // Ensure free_notes is properly processed (checking for both null and undefined)
          freeNotesValue = (product.free_notes !== null && product.free_notes !== undefined) ? 
            String(product.free_notes) : freeNotesValue;
        } catch (err) {
          console.error('Error processing product notes:', err);
        }

        return {
          id: product.id,
          sku: product.sku,
          name: product.name,
          description: product.description,
          price: product.price,
          imageUrl: product.images?.[0] ? normalizeStorageUrl(product.images[0]) : '',
          images: (product.images || []).map((img: string) => normalizeStorageUrl(img)),
          designFiles: (product.design_files || []).map((file: string) => normalizeStorageUrl(file)),
          categoryId: product.category_id,
          category: product.category_id && product.category_name ? {
            id: product.category_id,
            name: product.category_name,
            description: product.category_description,
            type: product.category_type,
            visible: true,
            saleEnded: product.category_sale_ended ?? false,
            eligibilityRules: {
              groups: product.category_eligibility_rules?.groups || []
            }
          } : undefined,
          collectionId: product.collection_id,
          collectionName: product.collection_name,
          collectionSlug: product.collection_slug,
          collectionLaunchDate: product.collection_launch_date ? new Date(product.collection_launch_date) : undefined,
          collectionSaleEnded: product.collection_sale_ended ?? false,
          categorySaleEnded: product.category_sale_ended ?? false,
          slug: product.slug || '',
          stock: product.quantity,
          minimumOrderQuantity: product.minimum_order_quantity || 50,
          variants: product.variants || [],
          variantPrices: product.variant_prices || {},
          priceModifierBeforeMin: product.price_modifier_before_min ?? null,
          priceModifierAfterMin: product.price_modifier_after_min ?? null,
          pinOrder: product.pin_order ?? null,
          blankCode: product.blank_code || '',
          technique: product.technique || '',
          noteForSupplier: product.note_for_supplier || '',
          visible: product.visible ?? true,
          saleEnded: product.sale_ended ?? false,
          notes: notesObject,  // Always pass the properly structured object
          freeNotes: freeNotesValue,
          recommendedCa: product.recommended_ca || null, // Optional CA for recommended token
          baseCurrency: product.base_currency || 'sol', // Add baseCurrency field with default to 'sol'
        };
      });

      if (isMountedRef.current) {
        setProducts(transformedProducts || []);
        setLoading(false);
      }
      
      // Cache the transformed products
      await cacheManager.set(
        cacheKey,
        transformedProducts || [],
        CACHE_DURATIONS.SEMI_DYNAMIC.TTL, 
        { staleTime: CACHE_DURATIONS.SEMI_DYNAMIC.STALE }
      );
    } catch (err) {
      console.error('Error fetching products:', err);
      if (isMountedRef.current) {
        setError(handleError(err));
        setLoading(false);
      }
    } finally {
      isFetchingRef.current = false;
    }
  }, [collectionId, categoryId, isMerchant]);

  useEffect(() => {
    isMountedRef.current = true;
    fetchProducts(false);
    
    return () => {
      isMountedRef.current = false;
    };
  }, [fetchProducts]);

  const refreshProducts = useCallback(() => fetchProducts(true), [fetchProducts]);

  return { 
    products, 
    loading, 
    error,
    refreshProducts
  };
}