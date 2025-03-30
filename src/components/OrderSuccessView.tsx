import { motion } from 'framer-motion';
import { ShoppingBag, ExternalLink, Share2, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface OrderSuccessViewProps {
  productName: string;
  collectionName: string;
  collectionSlug: string;
  productImage: string;
  orderNumber: string;
  transactionSignature: string;
  onClose: () => void;
}

export function OrderSuccessView({
  productName,
  collectionName,
  collectionSlug,
  productImage,
  orderNumber,
  transactionSignature,
  onClose
}: OrderSuccessViewProps) {
  const navigate = useNavigate();

  const handleShare = () => {
    const text = encodeURIComponent(
      `I just got my ${collectionName} swag on @storedotfun https://store.fun/c/${collectionSlug}`
    );
    window.open(`https://twitter.com/intent/tweet?text=${text}`, '_blank');
  };

  const handleNavigation = (path: string) => {
    onClose();
    navigate(path);
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="fixed inset-0 flex items-center justify-center z-50 p-2 sm:p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: 20 }}
        animate={{ y: 0 }}
        className="relative w-full max-w-md sm:max-w-lg bg-gradient-to-br from-purple-900/90 via-indigo-900/90 to-blue-900/90 rounded-xl p-4 sm:p-6 overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 sm:top-4 sm:right-4 text-gray-400 hover:text-white transition-colors z-10"
          aria-label="Close"
        >
          <X className="w-5 h-5 sm:w-6 sm:h-6" />
        </button>

        {/* Holographic effect overlays - with pointer-events-none */}
        <div className="absolute inset-0 bg-gradient-to-r from-purple-500/10 via-transparent to-blue-500/10 pointer-events-none" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_-20%,rgba(120,0,255,0.1),transparent_70%)] pointer-events-none" />
        
        {/* Success animation */}
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", delay: 0.2 }}
          className="mb-4 sm:mb-6 flex justify-center"
        >
          <div className="w-12 h-12 sm:w-16 sm:h-16 bg-gradient-to-br from-purple-500 to-blue-500 rounded-full flex items-center justify-center">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", delay: 0.4 }}
            >
              <ShoppingBag className="w-6 h-6 sm:w-8 sm:h-8 text-white" />
            </motion.div>
          </div>
        </motion.div>

        {/* Content */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="text-center space-y-3 sm:space-y-4"
        >
          <h2 className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-purple-300 via-blue-200 to-purple-300 bg-clip-text text-transparent">
            CONGRATS, your order has been placed!
          </h2>
          
          <p className="text-sm sm:text-base text-gray-300">
            You are the proud owner of:
          </p>
          
          <div className="relative group">
            <div className="absolute -inset-1 bg-gradient-to-r from-purple-500 to-blue-500 rounded-lg blur opacity-25 group-hover:opacity-75 transition duration-1000 pointer-events-none"></div>
            <div className="relative p-3 sm:p-4 bg-black/50 rounded-lg">
              <h3 className="text-lg sm:text-xl font-semibold text-white mb-1 sm:mb-2">{productName}</h3>
              <p className="text-sm text-purple-300">by {collectionName}</p>
              <div className="mt-3 sm:mt-4">
                <img
                  src={productImage}
                  alt={productName}
                  className="w-full h-32 sm:h-48 object-cover rounded-lg"
                />
              </div>
            </div>
          </div>

          <div className="space-y-2 sm:space-y-3 mt-4 sm:mt-6">
            <div className="flex items-center justify-center space-x-2 text-xs sm:text-sm">
              <span className="text-gray-400">Order #:</span>
              <span className="font-mono text-purple-300">{orderNumber}</span>
            </div>
            
            <div className="flex items-center justify-center space-x-2 text-xs sm:text-sm">
              <span className="text-gray-400">Transaction:</span>
              <a
                href={`https://solscan.io/tx/${transactionSignature}`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-purple-300 hover:text-purple-200 flex items-center gap-1"
              >
                {`${transactionSignature.slice(0, 6)}...${transactionSignature.slice(-6)}`}
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row justify-center gap-2 sm:gap-4 mt-6 sm:mt-8">
            <button
              onClick={() => handleNavigation('/orders')}
              className="px-4 sm:px-6 py-2 text-sm bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
            >
              See My Orders
            </button>
            <button
              onClick={() => handleNavigation('/')}
              className="px-4 sm:px-6 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
            >
              Continue Shopping
            </button>
            <button
              onClick={handleShare}
              className="px-4 sm:px-6 py-2 text-sm bg-[#1DA1F2] hover:bg-[#1a8cd8] text-white rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              <Share2 className="w-3 h-3 sm:w-4 sm:h-4" />
              Share
            </button>
          </div>
        </motion.div>
      </motion.div>
    </motion.div>
  );
} 