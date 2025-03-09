import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { X, ChevronLeft, ChevronRight, Clock, Ban } from 'lucide-react';
import { CategoryDescription } from '../collections/CategoryDescription';
import { VariantDisplay } from './variants/VariantDisplay';
import { ProductVariantPrice } from './ProductVariantPrice';
import { OrderProgressBar } from '../ui/OrderProgressBar';
import { BuyButton } from './BuyButton';
import { useSwipe } from '../../hooks/useSwipe';
import { OptimizedImage } from '../ui/OptimizedImage';
import { SmoothScroll } from '../ui/SmoothScroll';
import type { Product } from '../../types';

interface ProductModalProps {
  product: Product;
  onClose: () => void;
  categoryIndex: number;
}

export function ProductModal({ product, onClose, categoryIndex }: ProductModalProps) {
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>({});
  const modalRef = useRef<HTMLDivElement>(null);
  const images = product.images?.length ? product.images : [product.imageUrl];
  
  // Safe check for variants
  const hasVariants = !!product.variants && product.variants.length > 0;

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, []);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  const handleOptionChange = (variantId: string, value: string) => {
    setSelectedOptions(prev => ({
      ...prev,
      [variantId]: value
    }));
  };

  const nextImage = () => {
    setSelectedImageIndex((prev) => (prev + 1) % images.length);
  };

  const prevImage = () => {
    setSelectedImageIndex((prev) => (prev - 1 + images.length) % images.length);
  };

  const swipeHandlers = useSwipe({
    onSwipeLeft: nextImage,
    onSwipeRight: prevImage,
    threshold: 50
  });

  const allOptionsSelected = hasVariants
    ? product.variants!.every(variant => selectedOptions[variant.id])
    : true;

  // Check if collection is not live yet or sale has ended
  const isUpcoming = product.collectionLaunchDate ? new Date(product.collectionLaunchDate) > new Date() : false;
  const isSaleEnded = product.collectionSaleEnded;

  return (
    <div 
      className="fixed inset-0 z-50 overflow-y-auto" 
      aria-modal="true" 
      role="dialog"
      aria-labelledby="modal-title"
    >
      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />

      <div className="relative min-h-screen flex items-center justify-center p-0 sm:p-4">
        <div 
          ref={modalRef}
          className="relative bg-gray-900 w-full h-full sm:h-auto sm:max-h-[90vh] sm:w-auto sm:min-w-[600px] sm:max-w-4xl sm:rounded-xl overflow-hidden"
        >
          <div className="absolute top-4 right-4 z-10">
            <button
              onClick={onClose}
              className="p-2 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors"
              aria-label="Close modal"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 h-full">
            <div 
              className="relative aspect-square sm:aspect-auto"
              {...swipeHandlers}
            >
              <OptimizedImage
                src={images[selectedImageIndex]}
                alt={product.name}
                width={800}
                quality={85}
                priority={true}
                draggable={false}
              />
              
              {/* Preload next and previous images */}
              <div className="hidden">
                {images.length > 1 && [
                  (selectedImageIndex + 1) % images.length,
                  (selectedImageIndex - 1 + images.length) % images.length
                ].map(index => (
                  <img 
                    key={index}
                    src={images[index]} 
                    alt="Preload" 
                    aria-hidden="true"
                  />
                ))}
              </div>
              
              {images.length > 1 && (
                <>
                  <button
                    onClick={prevImage}
                    className="absolute left-4 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors"
                    aria-label="Previous image"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                  <button
                    onClick={nextImage}
                    className="absolute right-4 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors"
                    aria-label="Next image"
                  >
                    <ChevronRight className="h-5 w-5" />
                  </button>

                  <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
                    {images.map((_, index) => (
                      <button
                        key={index}
                        onClick={() => {
                          setSelectedImageIndex(index);
                        }}
                        className={`w-2 h-2 rounded-full transition-colors ${
                          index === selectedImageIndex
                            ? 'bg-white'
                            : 'bg-white/50 hover:bg-white/75'
                        }`}
                        aria-label={`Go to image ${index + 1}`}
                        aria-current={index === selectedImageIndex}
                      />
                    ))}
                  </div>
                </>
              )}
            </div>

            <div className="flex flex-col h-full max-h-[60vh] md:max-h-[90vh] overflow-hidden">
              <SmoothScroll className="p-4 space-y-4 flex-1">
                {product.collectionSlug && product.collectionName && (
                  <Link
                    to={`/${product.collectionSlug}`}
                    onClick={onClose}
                    className="text-sm text-gray-400 hover:text-purple-400 transition-colors"
                  >
                    {product.collectionName}
                  </Link>
                )}

                <div>
                  <h2 id="modal-title" className="text-xl font-bold text-white">{product.name}</h2>
                  <p className="mt-2 text-sm text-gray-400">{product.description}</p>
                </div>

                {hasVariants && (
                  <VariantDisplay
                    variants={product.variants!}
                    selectedOptions={selectedOptions}
                    onChange={handleOptionChange}
                  />
                )}

                <ProductVariantPrice
                  product={product}
                  selectedOptions={selectedOptions}
                />

                <OrderProgressBar
                  productId={product.id}
                  minimumOrderQuantity={product.minimumOrderQuantity || 50}
                  maxStock={product.stock}
                />

                {isUpcoming ? (
                  <button 
                    disabled
                    className="w-full flex items-center justify-center gap-2 bg-gray-800/80 backdrop-blur-sm text-gray-400 px-4 py-3 rounded-lg cursor-not-allowed transition-colors text-sm sm:text-base"
                  >
                    <Clock className="h-4 w-4 sm:h-5 sm:w-5" />
                    <span>Coming Soon</span>
                  </button>
                ) : isSaleEnded ? (
                  <button 
                    disabled
                    className="w-full flex items-center justify-center gap-2 bg-red-900/20 backdrop-blur-sm text-red-400 px-4 py-3 rounded-lg cursor-not-allowed transition-colors text-sm sm:text-base"
                  >
                    <Ban className="h-4 w-4 sm:h-5 sm:w-5" />
                    <span>Sale Ended</span>
                  </button>
                ) : (
                  <BuyButton
                    product={product}
                    price={product.price}
                    selectedOptions={selectedOptions}
                    disabled={product.stock === 0 || (hasVariants && !allOptionsSelected)}
                    className="w-full flex items-center justify-center gap-2 py-3 text-sm sm:text-base"
                    showModal={true}
                  />
                )}

                {product.category && (
                  <div className="border-t border-gray-800 pt-4">
                    <h3 className="text-sm font-medium mb-2">Category & Eligibility</h3>
                    <div className="bg-gray-950/50 rounded-lg p-3">
                      <CategoryDescription 
                        category={product.category} 
                        categoryIndex={categoryIndex}
                      />
                    </div>
                  </div>
                )}
              </SmoothScroll>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}