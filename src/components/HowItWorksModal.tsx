import { X } from 'lucide-react';
import { useHowItWorks } from '../contexts/HowItWorksContext';
import { Link } from 'react-router-dom';

export function HowItWorksModal() {
  const { isOpen, closeHowItWorks } = useHowItWorks();

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-[60]" 
      aria-modal="true" 
      role="dialog"
      aria-labelledby="modal-title"
    >
      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[58]" onClick={closeHowItWorks} />

      <div className="fixed inset-0 flex items-center justify-center p-4 z-[59]">
        <div className="relative bg-gray-900 w-full max-w-md rounded-xl overflow-hidden">
          <div className="absolute top-2 right-2 sm:top-3 sm:right-3 z-[60]">
            <button
              onClick={closeHowItWorks}
              className="p-2 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors"
              aria-label="Close modal"
            >
              <X className="h-4 w-4 sm:h-5 sm:w-5" />
            </button>
          </div>

          <div className="p-4 sm:p-5 space-y-4 sm:space-y-5 text-center">
            <div>
              <h2 id="modal-title" className="text-lg sm:text-xl font-bold text-white">How it Works</h2>
            </div>

            <div className="space-y-3 text-sm sm:text-base">
              <p className="text-white">
                Shop exclusive merch on store.fun with features like bonding curves, whitelists, token & NFT-gating, and more.
              </p>

              <div className="space-y-2 text-white">
                <p><span className="font-semibold">Step 1:</span> Find a product you like.</p>
                <p><span className="font-semibold">Step 2:</span> Connect your wallet and check for eligibility.</p>
                <p><span className="font-semibold">Step 3:</span> Buy early to score the best price.</p>
                <p><span className="font-semibold">Step 4:</span> Pay with SOL and submit your order.</p>
              </div>

              <p className="text-xs sm:text-sm text-gray-400">
                All orders include FREE worldwide shipping (estimated 15-20 days) and a quality guarantee.
              </p>
            </div>

            <div className="mt-4 sm:mt-5 space-y-3">
              <button
                onClick={closeHowItWorks}
                className="w-full bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg transition-colors text-sm sm:text-base"
              >
                I'm ready to shop
              </button>

              <div className="flex flex-wrap justify-center gap-2 sm:gap-3 text-xs sm:text-sm text-gray-400">
                <Link
                  to="/privacy"
                  className="hover:text-white transition-colors"
                  onClick={closeHowItWorks}
                >
                  Privacy Policy
                </Link>
                <span className="text-gray-600">•</span>
                <Link
                  to="/terms"
                  className="hover:text-white transition-colors"
                  onClick={closeHowItWorks}
                >
                  Terms of Use
                </Link>
                <span className="text-gray-600">•</span>
                <a
                  href="https://t.me/storedotfun"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-white transition-colors"
                >
                  Support
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 