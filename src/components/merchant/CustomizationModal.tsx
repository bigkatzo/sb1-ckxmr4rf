import React from 'react';
import { X, Image as ImageIcon, FileText } from 'lucide-react';
import { OptimizedImage } from '../ui/OptimizedImage';
import type { CustomData } from '../../services/customData';

interface CustomizationModalProps {
  isOpen: boolean;
  onClose: () => void;
  customData: CustomData | null;
  orderNumber: string;
  productName: string;
}

export function CustomizationModal({
  isOpen,
  onClose,
  customData,
  orderNumber,
  productName
}: CustomizationModalProps) {
  if (!isOpen) return null;

  // Handle both CustomData interface and order.custom_data structure
  const hasImage = customData?.customizable_image;
  const hasText = customData?.customizable_text;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative bg-gray-900 rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-800">
          <div>
            <h2 className="text-xl font-semibold text-white">Customization Details</h2>
            <p className="text-sm text-gray-400 mt-1">
              Order #{orderNumber} • {productName}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
          {!customData ? (
            <div className="text-center py-8">
              <div className="text-gray-400 mb-4">
                <FileText className="h-12 w-12 mx-auto" />
              </div>
              <p className="text-gray-300">No customization data found for this order.</p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Custom Image */}
              {hasImage && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <ImageIcon className="h-5 w-5 text-blue-400" />
                    <h3 className="text-lg font-medium text-white">Custom Image</h3>
                  </div>
                  <div className="bg-gray-800 rounded-lg p-4">
                    <div className="relative aspect-square max-w-md mx-auto">
                      <OptimizedImage
                        src={customData.customizable_image!}
                        alt="Custom product image"
                        width={400}
                        height={400}
                        quality={90}
                        className="object-contain w-full h-full rounded-lg"
                        sizes="(max-width: 768px) 100vw, 400px"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Custom Text */}
              {hasText && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <FileText className="h-5 w-5 text-green-400" />
                    <h3 className="text-lg font-medium text-white">Custom Text</h3>
                  </div>
                  <div className="bg-gray-800 rounded-lg p-4">
                    <p className="text-gray-200 whitespace-pre-wrap break-words">
                      {customData.customizable_text}
                    </p>
                  </div>
                </div>
              )}

              {/* Metadata */}
              <div className="border-t border-gray-800 pt-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-400">Created:</span>
                    <p className="text-gray-200 mt-1">
                      {customData.created_at ? 
                        `${new Date(customData.created_at).toLocaleDateString()} at ${new Date(customData.created_at).toLocaleTimeString()}` :
                        'Date not available'
                      }
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end p-6 border-t border-gray-800">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
} 