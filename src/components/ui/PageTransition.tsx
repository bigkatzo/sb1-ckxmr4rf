import { motion } from 'framer-motion';
import { ReactNode } from 'react';
import { useLocation } from 'react-router-dom';

interface PageTransitionProps {
  children: ReactNode;
}

export function PageTransition({ children }: PageTransitionProps) {
  const location = useLocation();
  
  // Animation variants for page transitions
  // Simplified for better performance
  const variants = {
    initial: { 
      opacity: 0.95
    },
    animate: { 
      opacity: 1,
      transition: { 
        duration: 0.15,
        ease: "easeOut",
        opacity: { duration: 0.1 }
      }
    },
    exit: { 
      opacity: 0,
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
      className="w-full"
    >
      {children}
    </motion.div>
  );
} 