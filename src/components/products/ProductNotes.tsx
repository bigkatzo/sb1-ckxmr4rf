import { Package, ShieldCheck, Ban, Info } from 'lucide-react';
import { Link } from 'react-router-dom';

interface ProductNotesProps {
  notes?: {
    shipping?: string;
    quality?: string;
    returns?: string;
  };
  freeNotes?: string;
}

export function ProductNotes({ notes, freeNotes }: ProductNotesProps) {
  const defaultNotes = {
    shipping: "Free Shipping Worldwide included (15-20 days*)",
    quality: "Quality is guaranteed. If there is a print error or visible quality issue, we'll replace or refund it.",
    returns: "Because the products are made to order, we do not accept general returns or sizing-related returns."
  };

  // Create a display notes object where each field falls back to default independently
  const displayNotes = {
    shipping: notes?.shipping || defaultNotes.shipping,
    quality: notes?.quality || defaultNotes.quality,
    returns: notes?.returns || defaultNotes.returns
  };

  // Check if free notes is non-empty string with better handling for edge cases
  const hasFreeNotes = typeof freeNotes === 'string' && freeNotes.trim() !== '';

  return (
    <div className="border-t border-gray-800 pt-4">
      <h3 className="text-sm font-medium mb-2">Product Notes</h3>
      <div className="space-y-2">
        {displayNotes.shipping && (
          <div className="flex items-start gap-2 bg-gray-950/50 rounded-lg p-3">
            <Package className="h-5 w-5 text-secondary mt-0.5 flex-shrink-0" />
            <p className="text-sm text-gray-300">{displayNotes.shipping}</p>
          </div>
        )}
        
        {displayNotes.quality && (
          <div className="flex items-start gap-2 bg-gray-950/50 rounded-lg p-3">
            <ShieldCheck className="h-5 w-5 text-secondary mt-0.5 flex-shrink-0" />
            <p className="text-sm text-gray-300">{displayNotes.quality}</p>
          </div>
        )}
        
        {displayNotes.returns && (
          <div className="flex items-start gap-2 bg-gray-950/50 rounded-lg p-3">
            <Ban className="h-5 w-5 text-secondary mt-0.5 flex-shrink-0" />
            <p className="text-sm text-gray-300">{displayNotes.returns}</p>
          </div>
        )}

        {hasFreeNotes && (
          <div className="flex items-start gap-2 bg-gray-950/50 rounded-lg p-3">
            <Info className="h-5 w-5 text-secondary mt-0.5 flex-shrink-0" />
            <p className="text-sm text-gray-300 whitespace-pre-wrap">{freeNotes}</p>
          </div>
        )}

        <div className="text-center pt-2">
          <Link to="/returns-faq" className="text-sm text-secondary hover:text-secondary-light transition-colors">
            View Returns & FAQ
          </Link>
        </div>
      </div>
    </div>
  );
} 