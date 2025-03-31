import { X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';

interface HowItWorksModalProps {
  onClose: () => void;
}

export function HowItWorksModal({ onClose }: HowItWorksModalProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="fixed inset-0 flex items-center justify-center z-40 p-2 sm:p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: 20 }}
        animate={{ y: 0 }}
        className="relative w-full max-w-sm bg-gradient-to-br from-purple-900/90 via-indigo-900/90 to-blue-900/90 rounded-xl p-4 sm:p-5 overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-2 right-2 sm:top-3 sm:right-3 text-gray-400 hover:text-white transition-colors z-10"
          aria-label="Close"
        >
          <X className="w-4 h-4 sm:w-5 sm:h-5" />
        </button>

        {/* Holographic effect overlays - with pointer-events-none */}
        <div className="absolute inset-0 bg-gradient-to-r from-purple-500/10 via-transparent to-blue-500/10 pointer-events-none" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_-20%,rgba(120,0,255,0.1),transparent_70%)] pointer-events-none" />
        
        {/* Content */}
        <div className="relative">
          <h2 className="text-lg sm:text-xl font-bold text-white mb-2 sm:mb-3">How it Works</h2>

          <div className="space-y-3 text-sm sm:text-base text-gray-300">
            <p>
              Shop exclusive merch on store.fun with features like bonding curves, whitelists, token & NFT-gating, and more.
            </p>

            <div className="space-y-2">
              <p><span className="font-semibold">Step 1:</span> Browse limited-edition drops, and find a product you like.</p>
              <p><span className="font-semibold">Step 2:</span> Connect your wallet and check for eligibility for exclusive items.</p>
              <p><span className="font-semibold">Step 3:</span> Buy early to score the best price.</p>
              <p><span className="font-semibold">Step 4:</span> Pay with SOL and submit your order.</p>
            </div>

            <p className="text-xs sm:text-sm text-gray-400">
              All orders include FREE worldwide shipping (estimated 15-20 days) and a quality guarantee.
            </p>
          </div>

          <div className="mt-4 sm:mt-5 space-y-3">
            <button
              onClick={onClose}
              className="w-full bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg transition-colors text-sm sm:text-base"
            >
              I'm ready to shop
            </button>

            <div className="flex flex-wrap justify-center gap-2 sm:gap-3 text-xs sm:text-sm text-gray-400">
              <Link
                to="/privacy"
                className="hover:text-gray-300"
                onClick={onClose}
              >
                Privacy Policy
              </Link>
              <span className="text-gray-600">•</span>
              <Link
                to="/terms"
                className="hover:text-gray-300"
                onClick={onClose}
              >
                Terms of Use
              </Link>
              <span className="text-gray-600">•</span>
              <a
                href="https://t.me/storedotfun"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-gray-300"
                onClick={onClose}
              >
                Support
              </a>
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
} 