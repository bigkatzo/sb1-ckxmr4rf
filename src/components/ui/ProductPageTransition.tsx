import { motion } from 'framer-motion';
import { ReactNode, useEffect } from 'react';
import { useLocation } from 'react-router-dom';

interface ProductPageTransitionProps {
  children: ReactNode;
}

export function ProductPageTransition({ children }: ProductPageTransitionProps) {
  const location = useLocation();
  
  // Add viewport meta tag to support iOS safe areas
  useEffect(() => {
    // Check if meta viewport exists
    const viewportMeta = document.querySelector('meta[name="viewport"]') as HTMLMetaElement | null;
    
    // If it doesn't exist, create it
    if (!viewportMeta) {
      const metaElement = document.createElement('meta');
      metaElement.setAttribute('name', 'viewport');
      document.head.appendChild(metaElement);
      
      // Set content with viewport-fit
      metaElement.setAttribute('content', 'width=device-width, initial-scale=1, viewport-fit=cover');
    } else {
      // Update existing meta tag to include viewport-fit=cover
      const currentContent = viewportMeta.getAttribute('content') || '';
      if (!currentContent.includes('viewport-fit=cover')) {
        const newContent = currentContent
          ? `${currentContent}, viewport-fit=cover`
          : 'width=device-width, initial-scale=1, viewport-fit=cover';
        viewportMeta.setAttribute('content', newContent);
      }
    }
  }, []);
  
  // Product-specific animations optimized for smoother transitions
  // Using similar motion patterns as main transitions but with horizontal direction
  const variants = {
    initial: { 
      opacity: 0.92, 
      x: 4,
      scale: 0.998
    },
    animate: { 
      opacity: 1, 
      x: 0,
      scale: 1,
      transition: { 
        duration: 0.18,
        ease: "easeOut",
        opacity: { duration: 0.12 } // Faster opacity transition
      }
    },
    exit: { 
      opacity: 0,
      scale: 0.999,
      transition: { 
        duration: 0.12,
        ease: "easeIn"
      }
    }
  };

  return (
    <motion.div
      initial="initial"
      animate="animate"
      exit="exit"
      variants={variants}
      key={location.pathname}
      // Improve CLS with a layout prop
      layout="position"
      // Use layoutId to maintain elements across transitions
      layoutId={`product-${location.pathname.split('/').slice(-1)[0]}`}
      className="product-page-container"
    >
      {children}
    </motion.div>
  );
} 