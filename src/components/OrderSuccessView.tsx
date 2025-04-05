import { motion } from 'framer-motion';
import { ShoppingBag, ExternalLink, Share2, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toPng } from 'html-to-image';

// Shareable version without sensitive info
const ShareableView = ({ productImage, collectionName }: { productImage?: string, collectionName: string }) => {
  return (
    <div 
      id="shareable-success" 
      style={{
        width: '600px',
        height: '400px',
        background: 'linear-gradient(135deg, rgb(76, 29, 149), rgb(30, 64, 175), rgb(30, 58, 138))',
        borderRadius: '12px',
        padding: '24px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        overflow: 'hidden',
        fontFamily: 'system-ui, -apple-system, sans-serif'
      }}
    >
      {/* Holographic overlays */}
      <div style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none'
      }}>
        <div style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(90deg, transparent, rgba(168, 85, 247, 0.1), transparent)',
          transform: 'rotate(12deg) translateY(-50%)'
        }} />
        <div style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(90deg, transparent, rgba(59, 130, 246, 0.1), transparent)',
          transform: 'rotate(-12deg) translateY(50%)'
        }} />
      </div>
      
      {productImage && (
        <img 
          src={productImage} 
          alt="Product" 
          style={{
            width: '192px',
            height: '192px',
            borderRadius: '12px',
            marginBottom: '24px',
            objectFit: 'cover'
          }}
          crossOrigin="anonymous"
        />
      )}
      
      <h2 style={{
        fontSize: '30px',
        fontWeight: 'bold',
        color: 'white',
        marginBottom: '16px',
        textAlign: 'center'
      }}>
        Just got my {collectionName} merch! 📦
      </h2>
      
      <p style={{
        fontSize: '18px',
        color: 'rgba(255, 255, 255, 0.9)',
        textAlign: 'center',
        marginBottom: '24px'
      }}>
        Find awesome products on Store.fun
      </p>

      <img 
        src="data:image/png;base64,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"
        alt="Store.fun Logo"
        style={{
          width: '200px',
          height: 'auto',
          marginBottom: '24px'
        }}
      />
    </div>
  );
};

interface OrderSuccessViewProps {
  productName: string;
  collectionName: string;
  productImage: string;
  orderNumber: string;
  transactionSignature: string;
  onClose: () => void;
  collectionSlug: string;
  receiptUrl?: string;
}

export function OrderSuccessView({
  productName,
  collectionName,
  productImage,
  orderNumber,
  transactionSignature,
  onClose,
  collectionSlug,
  receiptUrl
}: OrderSuccessViewProps) {
  const navigate = useNavigate();

  const handleShare = async () => {
    try {
      const shareableElement = document.getElementById('shareable-success');
      if (!shareableElement) {
        throw new Error('Could not find shareable element');
      }

      // Generate the PNG
      const dataUrl = await toPng(shareableElement, {
        quality: 1,
        pixelRatio: 2
      });

      // Convert to blob and create file
      const response = await fetch(dataUrl);
      const blob = await response.blob();
      const file = new File([blob], 'nft-success.png', { type: 'image/png' });

      // Prepare share text
      const cashtag = collectionSlug.replace(/[\s-]/g, '');
      const collectionUrl = `https://store.fun/${collectionSlug}`;
      const shareText = `Just got my ${collectionName} merch on @storedotfun! 📦 ${collectionUrl} get yours $${cashtag}`;

      // Check if we're on mobile
      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

      if (isMobile && navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          text: shareText
        });
        return;
      }

      // Twitter fallback
      const tweetText = encodeURIComponent(shareText);
      window.open(
        `https://twitter.com/intent/tweet?text=${tweetText}`,
        '_blank',
        'noopener,noreferrer'
      );

    } catch (error) {
      console.error('Share failed:', error);
      // Twitter fallback
      const fallbackText = encodeURIComponent(`Just got my ${collectionName} merch on @storedotfun! 📦`);
      window.open(
        `https://twitter.com/intent/tweet?text=${fallbackText}`,
        '_blank',
        'noopener,noreferrer'
      );
    }
  };

  const handleNavigation = (path: string) => {
    onClose();
    navigate(path);
  };

  return (
    <>
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
              We'll share your tracking details as soon as they're ready
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

              {receiptUrl && (
                <div className="flex items-center justify-center space-x-2 text-xs sm:text-sm">
                  <span className="text-gray-400">Receipt:</span>
                  <a
                    href={receiptUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-purple-300 hover:text-purple-200 flex items-center gap-1"
                  >
                    View Receipt
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              )}
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
      
      {/* Shareable view positioned off-screen but still rendered */}
      <div className="fixed left-[-9999px] top-0" style={{ width: '600px', height: '400px' }}>
        <ShareableView productImage={productImage} collectionName={collectionName} />
      </div>
    </>
  );
} 