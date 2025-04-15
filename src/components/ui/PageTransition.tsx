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
      opacity: 0.95, 
      y: 0,
      scale: 0.999
    },
    animate: { 
      opacity: 1, 
      y: 0,
      scale: 1,
      transition: { 
        duration: 0.15,
        ease: [0.25, 1, 0.5, 1], // Custom cubic-bezier for smoother motion
        opacity: { duration: 0.1 } // Faster opacity transition
      }
    },
    exit: { 
      opacity: 0,
      scale: 0.999,
      transition: { 
        duration: 0.10,
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
      style={{
        willChange: 'transform, opacity',
        backfaceVisibility: 'hidden',
        WebkitBackfaceVisibility: 'hidden',
        perspective: 1000,
        WebkitPerspective: 1000,
        transform: 'translate3d(0,0,0)'
      }}
      className="w-full"
    >
      {children}
    </motion.div>
  );
} 