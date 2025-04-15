import { motion } from 'framer-motion';
import { ReactNode } from 'react';
import { useLocation } from 'react-router-dom';

interface PageTransitionProps {
  children: ReactNode;
}

export function PageTransition({ children }: PageTransitionProps) {
  const location = useLocation();
  
  // Animation variants for page transitions
  // Optimized to minimize double loading appearance
  const variants = {
    initial: { opacity: 0.85, y: 5 },
    animate: { 
      opacity: 1, 
      y: 0,
      transition: { 
        duration: 0.2,
        ease: [0.25, 0.1, 0.25, 1.0] // Smooth easing
      }
    },
    exit: { 
      opacity: 0,
      y: -5,
      transition: { 
        duration: 0.15,
        ease: [0.25, 0.1, 0.25, 1.0]
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
    >
      {children}
    </motion.div>
  );
} 