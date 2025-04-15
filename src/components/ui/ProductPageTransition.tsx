import { motion } from 'framer-motion';
import { ReactNode } from 'react';
import { useLocation } from 'react-router-dom';

interface ProductPageTransitionProps {
  children: ReactNode;
}

export function ProductPageTransition({ children }: ProductPageTransitionProps) {
  const location = useLocation();
  
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
    >
      {children}
    </motion.div>
  );
} 