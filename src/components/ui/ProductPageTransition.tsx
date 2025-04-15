import { motion } from 'framer-motion';
import { ReactNode } from 'react';

interface ProductPageTransitionProps {
  children: ReactNode;
}

export function ProductPageTransition({ children }: ProductPageTransitionProps) {
  // Product-specific animations with a slight horizontal motion
  // Still keeping it subtle and fast for minimalist feel
  const variants = {
    initial: { 
      opacity: 0, 
      x: 15 
    },
    animate: { 
      opacity: 1, 
      x: 0,
      transition: { 
        duration: 0.3,
        ease: [0.25, 0.1, 0.25, 1.0] // Smooth easing
      }
    },
    exit: { 
      opacity: 0,
      x: -15,
      transition: { 
        duration: 0.2,
        ease: [0.25, 0.1, 0.25, 1.0]
      }
    }
  };

  return (
    <motion.div
      initial="initial"
      animate="animate"
      exit="exit"
      variants={variants}
    >
      {children}
    </motion.div>
  );
} 