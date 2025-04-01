import { Package, ShieldCheck, Ban } from 'lucide-react';

interface ProductNotesProps {
  notes?: {
    shipping?: string;
    quality?: string;
    returns?: string;
  };
}

export function ProductNotes({ notes }: ProductNotesProps) {
  const defaultNotes = {
    shipping: "Free Shipping Worldwide included (15-20 days*)",
    quality: "Quality is guaranteed. If there is a print error or visible quality issue, we'll replace or refund it.",
    returns: "Because the products are made to order, we do not accept general returns or sizing-related returns."
  };

  const displayNotes = notes || defaultNotes;

  return (
    <div className="border-t border-gray-800 pt-4">
      <h3 className="text-sm font-medium mb-2">Product Notes</h3>
      <div className="space-y-2">
        {displayNotes.shipping && (
          <div className="flex items-start gap-2 bg-gray-950/50 rounded-lg p-3">
            <Package className="h-5 w-5 text-purple-400 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-gray-300">{displayNotes.shipping}</p>
          </div>
        )}
        
        {displayNotes.quality && (
          <div className="flex items-start gap-2 bg-gray-950/50 rounded-lg p-3">
            <ShieldCheck className="h-5 w-5 text-purple-400 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-gray-300">{displayNotes.quality}</p>
          </div>
        )}
        
        {displayNotes.returns && (
          <div className="flex items-start gap-2 bg-gray-950/50 rounded-lg p-3">
            <Ban className="h-5 w-5 text-purple-400 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-gray-300">{displayNotes.returns}</p>
          </div>
        )}
      </div>
    </div>
  );
} 