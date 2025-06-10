import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

export interface SiteSettings {
  site_name: string;
  site_description?: string;
  homepage_tagline?: string;
  seo_description?: string;
  seo_title?: string;
  product_title_template?: string;
  product_description_template?: string;
  collection_title_template?: string;
  collection_description_template?: string;
  
  // Theme settings
  theme_primary_color: string;
  theme_secondary_color: string;
  theme_background_color: string;
  theme_text_color: string;
  theme_logo_url?: string;
}

export function useSiteSettings() {
  return useQuery<SiteSettings>({
    queryKey: ['site-settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('site_settings')
        .select('*')
        .single();

      if (error) {
        console.error('Error fetching site settings:', error);
        throw error;
      }

      return data as SiteSettings;
    },
    staleTime: 1 * 60 * 1000, // Consider data fresh for 1 minute
    gcTime: 5 * 60 * 1000 // Keep in cache for 5 minutes
  });
} 