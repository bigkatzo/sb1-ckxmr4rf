import { X } from 'lucide-react';

interface HowItWorksModalProps {
  onClose: () => void;
}

export function HowItWorksModal({ onClose }: HowItWorksModalProps) {
  return (
    <div 
      className="fixed inset-0 z-40 overflow-y-auto overscroll-contain" 
      aria-modal="true" 
      role="dialog"
      aria-labelledby="modal-title"
    >
      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />

      <div className="min-h-full flex items-center justify-center p-4">
        <div className="relative bg-gray-900 w-full max-w-2xl rounded-xl overflow-hidden">
          <div className="absolute top-4 right-4 z-10">
            <button
              onClick={onClose}
              className="p-2 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors"
              aria-label="Close modal"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="p-6 sm:p-8">
            <h2 id="modal-title" className="text-2xl font-bold text-white mb-6">How it Works</h2>

            <div className="space-y-6 text-gray-300">
              <p className="text-lg">
                Shop exclusive merch on store.fun with features like bonding curves, whitelists, token & NFT-gating, and more.
              </p>

              <div className="space-y-4">
                <p><span className="font-semibold">Step 1:</span> Browse limited-edition drops, and find a product you like.</p>
                <p><span className="font-semibold">Step 2:</span> Connect your wallet and check for eligibility for exclusive items.</p>
                <p><span className="font-semibold">Step 3:</span> Buy early to score the best price.</p>
                <p><span className="font-semibold">Step 4:</span> Pay with SOL and submit your order.</p>
              </div>

              <p className="text-sm text-gray-400">
                All orders include FREE worldwide shipping (estimated 15-20 days) and a quality guarantee.
              </p>
            </div>

            <div className="mt-8 space-y-4">
              <button
                onClick={onClose}
                className="w-full bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 rounded-lg transition-colors"
              >
                I'm ready to shop
              </button>

              <div className="flex justify-center space-x-6 text-sm text-gray-400">
                <a href="/privacy" className="hover:text-gray-300">Privacy Policy</a>
                <a href="/terms" className="hover:text-gray-300">Terms of Service</a>
                <a href="/support" className="hover:text-gray-300">Support</a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 