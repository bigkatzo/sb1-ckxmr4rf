import { useCallback } from 'react';
import { motion } from 'framer-motion';
import { ShoppingBag, ExternalLink, Share2, X, ShoppingCart } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toPng } from 'html-to-image';
import { 
  getTransactionUrl, 
  isStripeReceiptUrl 
} from '../utils/transactions';
import { useWallet } from '../contexts/WalletContext';
import { usePreventScroll } from '../hooks/usePreventScroll';

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
        src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAZAAAAB4CAYAAADc36SXAAAACXBIWXMAAAsSAAALEgHS3X78AAAAAXNSR0IArs4c6QAAIABJREFUeF7tnQe4dUV199fa50XI52eMYkGiiRU1ErtYEmyoxMRuINZEYsMoxF5iVESMBSOooBFsGAtKNCqfDWtsKBgR64cxRrEAakzUaPLKe/bK/C6z77vPueecPXtmTuPOep77XHjvnvbfs2fNzFrrv1SKFAQKAgWBgkBBIAIBjShTihQECgIFgYJAQUCKAimToCBQECgIFASiECgKJAq2UqggUBAoCBQEigIpc6AgUBAoCBQEohAoCiQKtlKoIFAQKAgUBIoCKXOgIFAQKAgUBKIQKAokCrZSqCBQECgIFASKAilzoCBQECgIFASiECgKJAq2UqggUBAoCBQEigIpc6AgUBAoCBQEohAoCiQKtlKoIFAQKAgUBIoCKXOgIFAQKAgUBKIQKAokCrZSqCBQECgIFASKAilzoCBQECgIFASiECgKJAq2UqggUBAoCBQEigIpc6AgUBAoCBQEohAoCiQKtlKoIFAQKAgUBIoCSQSwFC8IFAQKAtsVgaJAtuubL+MuCBQECgKJCBQFkghgKV4QKAgUBLYrAkWBbNc3X8ZdECgIFAQSESgKJBHAUrwgUBAoCGxXBIoC2a5vvoy7IFAQKAgkIlAUSCKApXhBoCBQENiuCBQFsl3ffBl3QaAgUBBIRKAokEQAS/GCQEGgILBdESgKZLu++TLugkBBoCCQiEBRIIkAluIFgYJAQWC7IlAUSCKApXhBoCBQENiuCBQFsl3ffBl3QaAgUBBIRORo0xjsAAAAAElFTkSuQmCC"
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
  receiptUrl?: string;
  
  // New optional props for batch orders
  totalItems?: number;
  itemPosition?: number;
  isBatchOrder?: boolean;
}

export function OrderSuccessView({
  productName,
  collectionName,
  productImage,
  orderNumber,
  transactionSignature,
  onClose,
  receiptUrl,
  totalItems,
  itemPosition,
  isBatchOrder
}: OrderSuccessViewProps) {
  usePreventScroll(true); // Modal is always showing when component is rendered
  
  const navigate = useNavigate();
  const { ensureAuthenticated } = useWallet();
  
  const handleOrdersNavigation = useCallback(async () => {
    const isAuthenticated = await ensureAuthenticated();
    if (isAuthenticated) {
      onClose();
      navigate('/orders');
    }
  }, [ensureAuthenticated, onClose, navigate]);

  const handleShare = async () => {
    try {
      // If we can use the Web Share API, try that first
      if (navigator.share) {
        await navigator.share({
          title: `${collectionName} Order Confirmation`,
          text: `Just got my ${collectionName} merch on Store.fun! 📦`,
          url: window.location.origin
        });
        return;
      }
      
      // Try to generate an image for social sharing
      const shareableElement = document.getElementById('shareable-success');
      if (!shareableElement) {
        throw new Error('Shareable element not found');
      }
      
      const dataUrl = await toPng(shareableElement, {
        quality: 0.95,
        pixelRatio: 2
      });
      
      // Create a blob from the dataURL
      const blob = await (await fetch(dataUrl)).blob();
      
      // Try to use the navigator.clipboard API for images
      try {
        // @ts-ignore - This is a newer API that TypeScript might not recognize
        if (navigator.clipboard?.write) {
          const clipboardItem = new ClipboardItem({
            [blob.type]: blob
          });
          // @ts-ignore
          await navigator.clipboard.write([clipboardItem]);
          alert('Image copied to clipboard! You can paste it into social media.');
          return;
        }
      } catch (clipError) {
        console.error('Clipboard API failed:', clipError);
      }
      
      // Fallback: create a download link
      const link = document.createElement('a');
      link.href = dataUrl;
      link.download = `${collectionName.replace(/\s+/g, '-').toLowerCase()}-order.png`;
      link.click();
      
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
          className="relative w-full max-w-md sm:max-w-lg bg-gradient-to-br from-primary/90 via-primary-dark/90 to-secondary/90 rounded-xl p-4 sm:p-6 overflow-hidden"
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
          <div className="absolute inset-0 bg-gradient-to-r from-primary/10 via-transparent to-secondary/10 pointer-events-none" />
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
                {isBatchOrder ? (
                  <ShoppingCart className="w-6 h-6 sm:w-8 sm:h-8 text-white" />
                ) : (
                  <ShoppingBag className="w-6 h-6 sm:w-8 sm:h-8 text-white" />
                )}
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
              <div className="absolute -inset-1 bg-gradient-to-r from-secondary to-blue-500 rounded-lg blur opacity-25 group-hover:opacity-75 transition duration-1000 pointer-events-none"></div>
              <div className="relative p-3 sm:p-4 bg-black/50 rounded-lg">
                <h3 className="text-lg sm:text-xl font-semibold text-white mb-1 sm:mb-2">{productName}</h3>
                <p className="text-sm text-secondary-light">by {collectionName}</p>
                {isBatchOrder && totalItems && totalItems > 0 && itemPosition && (
                  <div className="mt-2 text-xs font-medium text-blue-400">
                    Item {itemPosition} of {totalItems}
                  </div>
                )}
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
                <span className="font-mono text-secondary">{orderNumber}</span>
              </div>
              
              <div className="flex items-center justify-center space-x-2 text-xs sm:text-sm">
                <span className="text-gray-400">
                  {isStripeReceiptUrl(transactionSignature) ? 'Payment:' : 'Transaction:'}
                </span>
                <a
                  href={getTransactionUrl(transactionSignature)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`${isStripeReceiptUrl(transactionSignature) || transactionSignature?.startsWith('pi_') ? '' : 'font-mono'} text-secondary hover:text-secondary-hover flex items-center gap-1`}
                >
                  {isStripeReceiptUrl(transactionSignature) 
                    ? 'View Receipt' 
                    : transactionSignature?.startsWith('pi_')
                      ? 'View Receipt'
                      : `${transactionSignature.slice(0, 6)}...${transactionSignature.slice(-6)}`}
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>

              {/* Only show separate receipt URL if we have one and the transaction signature isn't already a receipt URL */}
              {receiptUrl && !isStripeReceiptUrl(transactionSignature) && !transactionSignature?.startsWith('pi_') && (
                <div className="flex items-center justify-center space-x-2 text-xs sm:text-sm">
                  <span className="text-gray-400">Receipt:</span>
                  <a
                    href={receiptUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-secondary hover:text-secondary-hover flex items-center gap-1"
                  >
                    View Receipt
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              )}
            </div>

            <div className="flex flex-col sm:flex-row justify-center gap-2 sm:gap-4 mt-6 sm:mt-8">
              <button
                onClick={handleOrdersNavigation}
                className="px-4 sm:px-6 py-2 text-sm bg-primary hover:bg-primary-hover text-white rounded-lg transition-colors"
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