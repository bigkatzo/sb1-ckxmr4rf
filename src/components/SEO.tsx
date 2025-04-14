import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

type SEOProps = {
  title?: string;
  description?: string;
  image?: string;
  productName?: string;
  collectionName?: string;
  type?: 'website' | 'product' | 'collection';
};

/**
 * Dynamic SEO component that updates page meta tags
 */
export default function SEO({
  title,
  description,
  image,
  productName,
  collectionName,
  type = 'website'
}: SEOProps) {
  const location = useLocation();
  
  useEffect(() => {
    // Update page title
    if (title) {
      document.title = title;
    }
    
    // Update meta descriptions
    if (description) {
      // Update standard description
      const metaDescription = document.querySelector('meta[name="description"]');
      if (metaDescription) {
        metaDescription.setAttribute('content', description);
      }
      
      // Update og:description
      const ogDescription = document.querySelector('meta[property="og:description"]');
      if (ogDescription) {
        ogDescription.setAttribute('content', description);
      }
      
      // Update twitter:description
      const twitterDescription = document.querySelector('meta[name="twitter:description"]');
      if (twitterDescription) {
        twitterDescription.setAttribute('content', description);
      }
    }
    
    // Update Open Graph type
    const ogType = document.querySelector('meta[property="og:type"]');
    if (ogType) {
      ogType.setAttribute('content', type === 'product' ? 'product' : 'website');
    }
    
    // Update Open Graph title
    if (title) {
      const ogTitle = document.querySelector('meta[property="og:title"]');
      if (ogTitle) {
        ogTitle.setAttribute('content', title);
      }
      
      const twitterTitle = document.querySelector('meta[name="twitter:title"]');
      if (twitterTitle) {
        twitterTitle.setAttribute('content', title);
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
    if (type === 'product' && productName && image) {
      const productData = {
        '@context': 'https://schema.org/',
        '@type': 'Product',
        name: productName,
        description: description,
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
    if (type === 'collection' && collectionName && image) {
      const collectionData = {
        '@context': 'https://schema.org/',
        '@type': 'CollectionPage',
        name: collectionName,
        description: description,
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
  }, [title, description, image, location.pathname, type, productName, collectionName]);
  
  // This component doesn't render anything
  return null;
} 