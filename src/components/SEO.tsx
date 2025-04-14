import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabase';

// Define the site settings type
type SiteSettings = {
  site_name?: string;
  site_description?: string;
  homepage_tagline?: string;
  seo_title?: string;
  seo_description?: string;
  theme_primary_color?: string;
  theme_secondary_color?: string;
  theme_background_color?: string;
  theme_text_color?: string;
  favicon_url?: string;
  icon_192_url?: string;
  icon_512_url?: string;
  apple_touch_icon_url?: string;
  og_image_url?: string;
  twitter_image_url?: string;
};

type SEOProps = {
  title?: string;
  description?: string;
  image?: string;
  productName?: string;
  collectionName?: string;
  type?: 'website' | 'product' | 'collection';
  pathname?: string;
  useDefault?: boolean;
};

/**
 * Dynamic SEO component that updates page meta tags
 */
export default function SEO({
  title = '',
  description = '',
  image = '/og.png',
  productName,
  collectionName,
  type = 'website',
  pathname,
  useDefault = true
}: SEOProps) {
  const location = useLocation();
  const [siteSettings, setSiteSettings] = useState<SiteSettings>({});
  
  // Fetch site settings when component mounts
  useEffect(() => {
    async function fetchSettings() {
      try {
        const { data } = await supabase
          .from('site_settings')
          .select('*')
          .single();
          
        if (data) {
          setSiteSettings(data);
        }
      } catch (error) {
        console.error('Error fetching site settings:', error);
      }
    }
    
    fetchSettings();
  }, []);
  
  const seoTitle = siteSettings?.seo_title || '';
  const seoDescription = siteSettings?.seo_description || '';
  const siteDescription = siteSettings?.site_description || '';
  const homepageTagline = siteSettings?.homepage_tagline || '';
  
  // Use the provided title, then fallback to SEO title, then site name
  let pageTitle = title;
  if (!pageTitle && useDefault) {
    pageTitle = seoTitle || siteSettings?.site_name || '';
  }
  
  // Use the provided description, SEO description, homepage tagline (for homepage), or site description
  let pageDescription = description;
  if (!pageDescription && useDefault) {
    if (location.pathname === '/' || pathname === '/') {
      // On homepage, prefer homepage_tagline, then seo_description, then site_description
      pageDescription = homepageTagline || seoDescription || siteDescription || '';
    } else {
      // On other pages, prefer seo_description, then site_description
      pageDescription = seoDescription || siteDescription || '';
    }
  }
  
  const isProduct = type === 'product';
  const isCollection = type === 'collection';
  
  useEffect(() => {
    // Update page title
    if (pageTitle) {
      document.title = pageTitle;
    }
    
    // Update meta descriptions
    if (pageDescription) {
      // Update standard description
      const metaDescription = document.querySelector('meta[name="description"]');
      if (metaDescription) {
        metaDescription.setAttribute('content', pageDescription);
      }
      
      // Update og:description
      const ogDescription = document.querySelector('meta[property="og:description"]');
      if (ogDescription) {
        ogDescription.setAttribute('content', pageDescription);
      }
      
      // Update twitter:description
      const twitterDescription = document.querySelector('meta[name="twitter:description"]');
      if (twitterDescription) {
        twitterDescription.setAttribute('content', pageDescription);
      }
    }
    
    // Update Open Graph type
    const ogType = document.querySelector('meta[property="og:type"]');
    if (ogType) {
      ogType.setAttribute('content', isProduct ? 'product' : 'website');
    }
    
    // Update Open Graph title
    if (pageTitle) {
      const ogTitle = document.querySelector('meta[property="og:title"]');
      if (ogTitle) {
        ogTitle.setAttribute('content', pageTitle);
      }
      
      const twitterTitle = document.querySelector('meta[name="twitter:title"]');
      if (twitterTitle) {
        twitterTitle.setAttribute('content', pageTitle);
      }
    }
    
    // Update images if provided
    if (image) {
      // Ensure image is an absolute URL
      const imageUrl = image.startsWith('http') ? image : window.location.origin + image;
      
      // Update OG image
      const ogImage = document.querySelector('meta[property="og:image"]');
      if (ogImage) {
        ogImage.setAttribute('content', imageUrl);
      }
      
      // Update Twitter image
      const twitterImage = document.querySelector('meta[name="twitter:image"]');
      if (twitterImage) {
        twitterImage.setAttribute('content', imageUrl);
      }
    }
    
    // Update canonical URL
    const canonicalUrl = window.location.origin + location.pathname;
    
    // Find existing canonical link or create one
    let canonicalLink = document.querySelector('link[rel="canonical"]');
    if (!canonicalLink) {
      canonicalLink = document.createElement('link');
      canonicalLink.setAttribute('rel', 'canonical');
      document.head.appendChild(canonicalLink);
    }
    canonicalLink.setAttribute('href', canonicalUrl);
    
    // Update og:url
    const ogUrl = document.querySelector('meta[property="og:url"]');
    if (ogUrl) {
      ogUrl.setAttribute('content', canonicalUrl);
    } else {
      const newOgUrl = document.createElement('meta');
      newOgUrl.setAttribute('property', 'og:url');
      newOgUrl.setAttribute('content', canonicalUrl);
      document.head.appendChild(newOgUrl);
    }
    
    // Add structured data for products
    if (isProduct && productName && image) {
      const productData = {
        '@context': 'https://schema.org/',
        '@type': 'Product',
        name: productName,
        description: pageDescription,
        image: image.startsWith('http') ? image : window.location.origin + image,
        url: canonicalUrl
      };
      
      let jsonLd = document.querySelector('script[type="application/ld+json"]');
      if (!jsonLd) {
        jsonLd = document.createElement('script');
        jsonLd.setAttribute('type', 'application/ld+json');
        document.head.appendChild(jsonLd);
      }
      
      jsonLd.textContent = JSON.stringify(productData);
    }
    
    // Add structured data for collections
    if (isCollection && collectionName && image) {
      const collectionData = {
        '@context': 'https://schema.org/',
        '@type': 'CollectionPage',
        name: collectionName,
        description: pageDescription,
        image: image.startsWith('http') ? image : window.location.origin + image,
        url: canonicalUrl
      };
      
      let jsonLd = document.querySelector('script[type="application/ld+json"]');
      if (!jsonLd) {
        jsonLd = document.createElement('script');
        jsonLd.setAttribute('type', 'application/ld+json');
        document.head.appendChild(jsonLd);
      }
      
      jsonLd.textContent = JSON.stringify(collectionData);
    }
    
    // Clean up
    return () => {
      // Remove structured data when unmounting
      const jsonLd = document.querySelector('script[type="application/ld+json"]');
      if (jsonLd) {
        jsonLd.remove();
      }
    };
  }, [pageTitle, pageDescription, image, location.pathname, isProduct, isCollection, productName, collectionName]);
  
  // This component doesn't render anything
  return null;
} 