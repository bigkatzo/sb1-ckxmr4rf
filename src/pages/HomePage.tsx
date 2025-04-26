import { CollectionScroller } from '../components/collections/CollectionScroller';
import { CollectionGrid } from '../components/collections/CollectionGrid';
import { FeaturedCollection } from '../components/collections/FeaturedCollection';
import { BestSellers } from '../components/products/BestSellers';
import { SectionHeader } from '../components/ui/SectionHeader';
import SEO from '../components/SEO';
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useFeaturedCollections } from '../hooks/useFeaturedCollections';
import { useCollections } from '../hooks/useCollections';
import { useBestSellers } from '../hooks/useBestSellers';

export function HomePage() {
  const [siteSettings, setSiteSettings] = useState({
    site_name: 'store.fun',
    site_description: 'Merch Marketplace',
    homepage_tagline: 'Discover and shop unique merchandise collections at store.fun'
  });
  
  // Get collection data for conditional rendering
  const { collections: featuredCollections, loading: featuredLoading } = useFeaturedCollections();
  const { collections: upcomingCollections, loading: upcomingLoading } = useCollections('upcoming');
  const { collections: latestCollections, loading: latestLoading } = useCollections('latest');
  const { products: bestSellerProducts, loading: bestSellersLoading } = useBestSellers(10);
  
  useEffect(() => {
    // Fetch site settings
    async function fetchSettings() {
      try {
        const { data, error } = await supabase
          .from('site_settings')
          .select('site_name, site_description, homepage_tagline, og_image_url')
          .single();
        
        if (error) {
          console.error('Error fetching site settings:', error);
          return;
        }
        
        if (data) {
          setSiteSettings({
            site_name: data.site_name || 'store.fun',
            site_description: data.site_description || 'Merch Marketplace',
            homepage_tagline: data.homepage_tagline || 'Discover and shop unique merchandise collections at store.fun'
          });
        }
      } catch (err) {
        console.error('Unexpected error:', err);
      }
    }
    
    fetchSettings();
  }, []);
  
  const seoTitle = `${siteSettings.site_name} | ${siteSettings.site_description}`;

  const hasFeaturedCollections = !featuredLoading && featuredCollections.length > 0;
  const hasUpcomingCollections = !upcomingLoading && upcomingCollections.length > 0;
  const hasLatestCollections = !latestLoading && latestCollections.length > 0;
  const hasBestSellers = !bestSellersLoading && bestSellerProducts.length > 0;

  return (
    <div className="scroll-smooth">
      {/* Default SEO for homepage */}
      <SEO 
        title={seoTitle}
        description={siteSettings.homepage_tagline}
        type="website"
      />
      
      {hasFeaturedCollections && <FeaturedCollection />}
      
      {hasBestSellers && (
        <section className="mt-4 sm:mt-6 md:mt-8">
          <SectionHeader
            title="Best Sellers"
          />
          <BestSellers />
        </section>
      )}

      {hasUpcomingCollections && (
        <section className="mt-4 sm:mt-6 md:mt-8">
          <SectionHeader
            title="Coming Soon"
          />
          <CollectionScroller filter="upcoming" />
        </section>
      )}

      {hasLatestCollections && (
        <section className="mt-4 sm:mt-6 md:mt-8">
          <SectionHeader
            title="Latest Drops"
          />
          <CollectionGrid filter="latest" />
        </section>
      )}
    </div>
  );
}