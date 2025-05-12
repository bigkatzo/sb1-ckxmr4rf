import { motion } from 'framer-motion';
import { ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { pageTransitionVariants } from '../../utils/transitions';

interface PageTransitionProps {
  children: ReactNode;
}

/**
 * Component that provides smooth transitions between pages
 * Maintains the current design while improving performance
 */
export function PageTransition({ children }: PageTransitionProps) {
  const location = useLocation();
  
  return (
    <motion.div
      key={location.pathname}
      initial="initial"
      animate="animate"
      exit="exit"
      variants={pageTransitionVariants}
      className="w-full"
    >
      {children}
    </motion.div>
  );
} 