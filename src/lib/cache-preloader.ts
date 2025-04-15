import { supabase } from './supabase';
import { cacheManager, CACHE_DURATIONS } from './cache';
import { normalizeStorageUrl } from './storage';

/**
 * Preloads critical data into the cache for faster initial page load
 */
export async function preloadCriticalData() {
  try {
    // Preload featured collections (static data)
    const { data: featuredCollections } = await supabase.rpc('get_featured_collections');
    if (featuredCollections && Array.isArray(featuredCollections)) {
      // Cache the list of featured collections
      cacheManager.set(
        'featured_collections', 
        featuredCollections, 
        CACHE_DURATIONS.SEMI_DYNAMIC.TTL, 
        {
          staleTime: CACHE_DURATIONS.SEMI_DYNAMIC.STALE
        }
      );
      
      // Cache each collection individually
      featuredCollections.forEach(collection => {
        // Cache static collection data
        const collectionStatic = {
          id: collection.id,
          name: collection.name,
          description: collection.description,
          image_url: collection.image_url || '',
          imageUrl: collection.image_url ? normalizeStorageUrl(collection.image_url) : '',
          slug: collection.slug,
        };
        
        cacheManager.set(
          `collection_static:${collection.id}`, 
          collectionStatic, 
          CACHE_DURATIONS.STATIC.TTL, 
          {
            staleTime: CACHE_DURATIONS.STATIC.STALE
          }
        );
        
        // Cache dynamic collection data
        const collectionDynamic = {
          launch_date: collection.launch_date,
          launchDate: new Date(collection.launch_date),
          featured: collection.featured,
          visible: collection.visible,
          sale_ended: collection.sale_ended,
          saleEnded: collection.sale_ended,
        };
        
        cacheManager.set(
          `collection_dynamic:${collection.id}`, 
          collectionDynamic, 
          CACHE_DURATIONS.SEMI_DYNAMIC.TTL, 
          {
            staleTime: CACHE_DURATIONS.SEMI_DYNAMIC.STALE
          }
        );
        
        // Preload collection slug for faster navigation
        cacheManager.set(
          `collection_slug:${collection.slug}`,
          collection.id,
          CACHE_DURATIONS.STATIC.TTL,
          {
            staleTime: CACHE_DURATIONS.STATIC.STALE
          }
        );
      });
      
      // Preload collections overview data for faster home page and navigation
      cacheManager.set(
        'collections_overview',
        featuredCollections.map(collection => ({
          id: collection.id,
          name: collection.name,
          slug: collection.slug,
          imageUrl: collection.image_url ? normalizeStorageUrl(collection.image_url) : '',
          featured: collection.featured,
        })),
        CACHE_DURATIONS.SEMI_DYNAMIC.TTL,
        {
          staleTime: CACHE_DURATIONS.SEMI_DYNAMIC.STALE
        }
      );
    }
    
    // Preload bestsellers (semi-dynamic data)
    const { data: bestSellers } = await supabase.rpc('get_best_sellers', { 
      p_limit: 6,
      p_sort_by: 'sales'
    });
    
    if (bestSellers && Array.isArray(bestSellers)) {
      // Transform and cache bestsellers
      const transformedProducts = bestSellers.map(product => {
        // Handle notes field
        const hasValidNotes = product.notes && typeof product.notes === 'object' && Object.keys(product.notes).length > 0;
        
        // Process free_notes
        const freeNotesValue = product.free_notes !== null ? String(product.free_notes || '') : '';
        
        return {
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
          salesCount: product.sales_count || 0,
          notes: hasValidNotes ? product.notes : undefined,
          freeNotes: freeNotesValue
        };
      });
      
      // Cache bestsellers list
      cacheManager.set(
        'bestsellers:6:sales', 
        { 
          products: transformedProducts,
          categoryIndices: {} // Will be computed when needed
        }, 
        CACHE_DURATIONS.SEMI_DYNAMIC.TTL, 
        {
          staleTime: CACHE_DURATIONS.SEMI_DYNAMIC.STALE
        }
      );
      
      // Cache individual product data
      transformedProducts.forEach(product => {
        // Static product data
        const productStatic = {
          id: product.id,
          sku: product.sku,
          name: product.name,
          description: product.description,
          imageUrl: product.imageUrl,
          images: product.images,
          categoryId: product.categoryId,
          category: product.category,
          collectionId: product.collectionId,
          collectionName: product.collectionName,
          collectionSlug: product.collectionSlug,
          slug: product.slug,
          variants: product.variants,
        };
        
        cacheManager.set(
          `product_static:${product.id}`, 
          productStatic, 
          CACHE_DURATIONS.STATIC.TTL, 
          {
            staleTime: CACHE_DURATIONS.STATIC.STALE
          }
        );
        
        // Dynamic product data
        const productDynamic = {
          price: product.price,
          stock: product.stock,
          minimumOrderQuantity: product.minimumOrderQuantity,
          variantPrices: product.variantPrices,
          priceModifierBeforeMin: product.priceModifierBeforeMin,
          priceModifierAfterMin: product.priceModifierAfterMin,
        };
        
        cacheManager.set(
          `product_dynamic:${product.id}`, 
          productDynamic, 
          CACHE_DURATIONS.REALTIME.TTL, 
          {
            staleTime: CACHE_DURATIONS.REALTIME.STALE
          }
        );
        
        // Stock data
        cacheManager.set(
          `product_stock:${product.id}`, 
          product.stock, 
          CACHE_DURATIONS.REALTIME.TTL, 
          {
            staleTime: CACHE_DURATIONS.REALTIME.STALE
          }
        );
        
        // Price data
        cacheManager.set(
          `product_price:${product.id}`, 
          {
            basePrice: product.price,
            variantPrices: product.variantPrices,
            priceModifierBeforeMin: product.priceModifierBeforeMin,
            priceModifierAfterMin: product.priceModifierAfterMin,
          }, 
          CACHE_DURATIONS.REALTIME.TTL, 
          {
            staleTime: CACHE_DURATIONS.REALTIME.STALE
          }
        );
        
        // Cache product slug for faster navigation
        cacheManager.set(
          `product_slug:${product.collectionSlug}:${product.slug}`,
          product.id,
          CACHE_DURATIONS.STATIC.TTL,
          {
            staleTime: CACHE_DURATIONS.STATIC.STALE
          }
        );
      });
      
      // Cache product preview data for faster collection browsing
      const productPreviews = transformedProducts.map(product => ({
        id: product.id,
        name: product.name,
        price: product.price,
        imageUrl: product.imageUrl,
        slug: product.slug,
        collectionSlug: product.collectionSlug,
        stock: product.stock > 0
      }));
      
      cacheManager.set(
        'product_previews',
        productPreviews,
        CACHE_DURATIONS.SEMI_DYNAMIC.TTL,
        {
          staleTime: CACHE_DURATIONS.SEMI_DYNAMIC.STALE
        }
      );
    }
    
    // Preload navigation resources
    preloadNavigationResources();
    
    console.log('Cache preloaded successfully');
    return true;
  } catch (err) {
    console.error('Error preloading cache:', err);
    return false;
  }
}

/**
 * Preload frequently accessed navigation resources
 */
async function preloadNavigationResources() {
  try {
    // Preload routes configuration for faster routing
    const routeConfig = {
      home: '/',
      orders: '/orders',
      tracking: '/tracking',
      collections: {},
      legal: {
        privacy: '/privacy',
        terms: '/terms',
        returns: '/returns-faq'
      }
    };
    
    cacheManager.set(
      'route_config',
      routeConfig,
      CACHE_DURATIONS.STATIC.TTL,
      {
        staleTime: CACHE_DURATIONS.STATIC.STALE
      }
    );
    
    // Preload navigation link states
    cacheManager.set(
      'navigation_state',
      {
        lastVisited: null,
        frequentlyAccessed: []
      },
      CACHE_DURATIONS.SEMI_DYNAMIC.TTL,
      {
        staleTime: CACHE_DURATIONS.SEMI_DYNAMIC.STALE
      }
    );
    
  } catch (err) {
    console.error('Error preloading navigation resources:', err);
  }
}

/**
 * Set up the cache preloader to run on initial load and periodically refresh
 */
export function setupCachePreloader() {
  // Run immediately
  preloadCriticalData();
  
  // Then refresh periodically
  const refreshInterval = setInterval(() => {
    preloadCriticalData();
  }, 5 * 60 * 1000); // Every 5 minutes
  
  // Return cleanup function
  return () => clearInterval(refreshInterval);
} 