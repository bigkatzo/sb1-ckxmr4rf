import { motion } from 'framer-motion';
import { ReactNode } from 'react';
import { useLocation } from 'react-router-dom';

interface PageTransitionProps {
  children: ReactNode;
}

export function PageTransition({ children }: PageTransitionProps) {
  const location = useLocation();
  
  // Animation variants for page transitions
  // Optimized with minimal movement and improved performance
  const variants = {
    initial: { 
      opacity: 0.92, 
      y: 2,
      scale: 0.998
    },
    animate: { 
      opacity: 1, 
      y: 0,
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
      key={location.pathname}
      initial="initial"
      animate="animate"
      exit="exit"
      variants={variants}
      // Improve CLS with a layout prop
      layout="position"
      // Reduce DOM operations with layoutId
      layoutId={`page-${location.pathname.split('/')[1] || 'home'}`}
    >
      {children}
    </motion.div>
  );
} 