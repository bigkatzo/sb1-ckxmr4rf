import { useState, useEffect, useRef } from 'react';
import { CollectionScroller } from '../components/collections/CollectionScroller';
import { CollectionGrid } from '../components/collections/CollectionGrid';
import { FeaturedCollection } from '../components/collections/FeaturedCollection';
import { BestSellers } from '../components/products/BestSellers';
import { SectionHeader } from '../components/ui/SectionHeader';
import { TransitionWrapper } from '../components/ui/TransitionWrapper';
import SEO from '../components/SEO';
import { supabase } from '../lib/supabase';
import { useFeaturedCollections } from '../hooks/useFeaturedCollections';
import { useCollections } from '../hooks/useCollections';
import { useBestSellers } from '../hooks/useBestSellers';
import { cacheManager, CACHE_DURATIONS } from '../lib/cache';

// Keep track of whether sections have been loaded before
let sectionsLoadedBefore = {
  featured: false,
  bestSellers: false,
  upcoming: false,
  latest: false
};

export function HomePage() {
  const [siteSettings, setSiteSettings] = useState({
    site_name: 'store.fun',
    site_description: 'Merch Marketplace',
    homepage_tagline: 'Discover and shop unique merchandise collections at store.fun'
  });
  
  // Store a reference to the page's mount state to prevent state updates on unmount
  const isMounted = useRef(true);
  // Track if settings are loaded from cache
  const settingsLoaded = useRef(false);
  
  // Get collection data for conditional rendering
  const { collections: featuredCollections } = useFeaturedCollections();
  const { collections: upcomingCollections, loading: upcomingLoading } = useCollections('upcoming');
  const { collections: latestCollections, loading: latestLoading } = useCollections('latest', {
    initialLimit: 9, // Increased for better initial grid view
    loadMoreCount: 6
  });
  const { products: bestSellerProducts, loading: bestSellersLoading } = useBestSellers(10);
  
  // Track initial loads for each section to avoid redundant transitions
  const [initialLoads, setInitialLoads] = useState({
    featured: !sectionsLoadedBefore.featured,
    bestSellers: !sectionsLoadedBefore.bestSellers,
    upcoming: !sectionsLoadedBefore.upcoming,
    latest: !sectionsLoadedBefore.latest
  });
  
  // Update loaded state for sections
  useEffect(() => {
    if (featuredCollections && featuredCollections.length > 0 && initialLoads.featured) {
      sectionsLoadedBefore.featured = true;
      setInitialLoads(prev => ({ ...prev, featured: false }));
    }
    
    if (bestSellerProducts && bestSellerProducts.length > 0 && initialLoads.bestSellers) {
      sectionsLoadedBefore.bestSellers = true;
      setInitialLoads(prev => ({ ...prev, bestSellers: false }));
    }
    
    if (upcomingCollections && upcomingCollections.length > 0 && initialLoads.upcoming) {
      sectionsLoadedBefore.upcoming = true;
      setInitialLoads(prev => ({ ...prev, upcoming: false }));
    }
    
    if (latestCollections && latestCollections.length > 0 && initialLoads.latest) {
      sectionsLoadedBefore.latest = true;
      setInitialLoads(prev => ({ ...prev, latest: false }));
    }
  }, [featuredCollections, bestSellerProducts, upcomingCollections, latestCollections, 
      initialLoads.featured, initialLoads.bestSellers, initialLoads.upcoming, initialLoads.latest]);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);
  
  // Load site settings with caching
  useEffect(() => {
    const loadSiteSettings = async () => {
      try {
        // Try to get from cache first
        const cacheKey = 'site_settings';
        const { value: cachedSettings, needsRevalidation } = await cacheManager.get<{
          site_name: string;
          site_description: string;
          homepage_tagline: string;
        }>(cacheKey);
        
        // Use cached settings if available
        if (cachedSettings && !settingsLoaded.current) {
          setSiteSettings(cachedSettings);
          settingsLoaded.current = true;
          
          // If cached data is stale, refresh in the background
          if (needsRevalidation) {
            fetchFreshSettings(cacheKey);
          }
          return;
        }
        
        if (!settingsLoaded.current) {
          await fetchFreshSettings(cacheKey);
        }
      } catch (err) {
        console.error('Error loading site settings:', err);
        if (!settingsLoaded.current) {
          await fetchFreshSettings();
        }
      }
    };
    
    const fetchFreshSettings = async (cacheKey?: string) => {
      if (!isMounted.current) return;
      
      try {
        const { data, error } = await supabase
          .from('site_settings')
          .select('site_name, site_description, homepage_tagline, og_image_url')
          .single();
        
        if (error) {
          console.error('Error fetching site settings:', error);
          return;
        }
        
        if (data && isMounted.current) {
          const newSettings = {
            site_name: data.site_name || 'store.fun',
            site_description: data.site_description || 'Merch Marketplace',
            homepage_tagline: data.homepage_tagline || 'Discover and shop unique merchandise collections at store.fun'
          };
          
          setSiteSettings(newSettings);
          settingsLoaded.current = true;
          
          // Cache the settings
          if (cacheKey) {
            cacheManager.set(
              cacheKey,
              newSettings,
              CACHE_DURATIONS.STATIC.TTL,
              {
                staleTime: CACHE_DURATIONS.STATIC.STALE,
                priority: CACHE_DURATIONS.STATIC.PRIORITY
              }
            );
          }
        }
      } catch (err) {
        console.error('Unexpected error:', err);
      }
    };
    
    loadSiteSettings();
  }, []);
  
  const seoTitle = `${siteSettings.site_name} | ${siteSettings.site_description}`;

  const hasUpcomingCollections = !upcomingLoading && upcomingCollections.length > 0;
  const hasLatestCollections = !latestLoading && latestCollections.length > 0;
  const hasBestSellers = !bestSellersLoading && bestSellerProducts.length > 0;

  return (
    <div className="scroll-smooth space-y-6 sm:space-y-8 md:space-y-12">
      {/* Default SEO for homepage */}
      <SEO 
        title={seoTitle}
        description={siteSettings.homepage_tagline}
        type="website"
      />
      
      {/* Featured Collection with consistent spacing regardless of loading state */}
      <TransitionWrapper
        identifier={initialLoads.featured ? 'featured-loading' : 'featured-loaded'}
        duration={initialLoads.featured ? 300 : 0}
        maintainSize={true}
        className="featured-collection-wrapper"
      >
        <FeaturedCollection />
      </TransitionWrapper>
      
      {/* Best Sellers with smooth transition */}
      <TransitionWrapper
        identifier={initialLoads.bestSellers ? 'best-sellers-loading' : 'best-sellers-loaded'}
        duration={initialLoads.bestSellers ? 350 : 0}
      >
        {hasBestSellers && (
          <section>
            <SectionHeader
              title="Best Sellers"
              to="/trending"
              secondaryTitle="New Products"
              secondaryTo="/trending?tab=launch_date"
            />
            <BestSellers />
          </section>
        )}
      </TransitionWrapper>

      {/* Upcoming Collections */}
      <TransitionWrapper
        identifier={initialLoads.upcoming ? 'upcoming-loading' : 'upcoming-loaded'}
        duration={initialLoads.upcoming ? 350 : 0}
      >
        {hasUpcomingCollections && (
          <section>
            <SectionHeader
              title="Coming Soon"
            />
            <CollectionScroller filter="upcoming" />
          </section>
        )}
      </TransitionWrapper>

      {/* Latest Collections with infinite scroll */}
      <TransitionWrapper
        identifier={initialLoads.latest ? 'latest-loading' : 'latest-loaded'}
        duration={initialLoads.latest ? 350 : 0}
      >
        {hasLatestCollections && (
          <section>
            <SectionHeader
              title="Latest Drops"
            />
            <CollectionGrid filter="latest" infiniteScroll={true} />
          </section>
        )}
      </TransitionWrapper>
    </div>
  );
}