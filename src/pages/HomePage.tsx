import { CollectionScroller } from '../components/collections/CollectionScroller';
import { CollectionGrid } from '../components/collections/CollectionGrid';
import { FeaturedCollection } from '../components/collections/FeaturedCollection';
import { BestSellers } from '../components/products/BestSellers';
import { SectionHeader } from '../components/ui/SectionHeader';
import SEO from '../components/SEO';
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export function HomePage() {
  const [siteSettings, setSiteSettings] = useState({
    site_name: 'store.fun',
    site_description: 'Merch Marketplace',
    homepage_tagline: 'Discover and shop unique merchandise collections at store.fun'
  });
  
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

  return (
    <div className="space-y-8 sm:space-y-12 scroll-smooth">
      {/* Default SEO for homepage */}
      <SEO 
        title={seoTitle}
        description={siteSettings.homepage_tagline}
        type="website"
      />
      
      <FeaturedCollection />
      
      <section>
        <SectionHeader
          title="Best Sellers"
        />
        <BestSellers />
      </section>

      <section>
        <SectionHeader
          title="Coming Soon"
        />
        <CollectionScroller filter="upcoming" />
      </section>

      <section>
        <SectionHeader
          title="Latest Drops"
        />
        <CollectionGrid filter="latest" />
      </section>
    </div>
  );
}