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
import type { Product } from '../../types';

interface ProductModalProps {
  product: Product;
  onClose: () => void;
  categoryIndex: number;
}

export function ProductModal({ product, onClose, categoryIndex }: ProductModalProps) {
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>({});
  const [isTransitioning, setIsTransitioning] = useState(false);
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
    if (isTransitioning) return;
    setIsTransitioning(true);
    setSelectedImageIndex((prev) => (prev + 1) % images.length);
    setTimeout(() => setIsTransitioning(false), 300); // Shorter duration for faster transitions
  };

  const prevImage = () => {
    if (isTransitioning) return;
    setIsTransitioning(true);
    setSelectedImageIndex((prev) => (prev - 1 + images.length) % images.length);
    setTimeout(() => setIsTransitioning(false), 300); // Shorter duration for faster transitions
  };

  const swipeHandlers = useSwipe({
    onSwipeLeft: nextImage,
    onSwipeRight: prevImage,
    threshold: 10 // Lower threshold for more responsive swipes
  });

  const allOptionsSelected = hasVariants
    ? product.variants!.every(variant => selectedOptions[variant.id])
    : true;

  // Check if collection is not live yet or sale has ended
  const isUpcoming = product.collectionLaunchDate ? new Date(product.collectionLaunchDate) > new Date() : false;
  const isSaleEnded = product.collectionSaleEnded;

  // Calculate transform with smooth transition
  const translateX = swipeHandlers.isDragging
    ? `${swipeHandlers.dragOffset}px` // Remove the 1.2x amplification
    : '0px';

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
          className="relative bg-gray-900 w-full h-full sm:h-auto sm:max-h-[90vh] sm:w-[800px] sm:max-w-5xl sm:rounded-xl overflow-hidden"
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

          {/* Mobile: Single scroll container, Desktop: Grid layout */}
          <div className="h-full md:grid md:grid-cols-2">
            <div className="w-full aspect-square md:aspect-auto md:h-[600px] relative bg-gray-950/50">
              {/* Fixed navigation arrows */}
              {images.length > 1 ? (
                <>
                  <button
                    onClick={prevImage}
                    className="hidden md:block absolute left-4 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors z-10"
                    aria-label="Previous image"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                  <button
                    onClick={nextImage}
                    className="hidden md:block absolute right-4 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors z-10"
                    aria-label="Next image"
                  >
                    <ChevronRight className="h-5 w-5" />
                  </button>

                  <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-2 z-10">
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
              ) : null}

              {/* Swipeable image container */}
              <div 
                className="absolute inset-0 touch-pan-x select-none overflow-hidden"
                {...swipeHandlers}
              >
                <div
                  className="absolute inset-0 will-change-transform transform-gpu flex items-center justify-center"
                  style={{
                    transform: `translateX(${translateX})`,
                    transition: 'transform 200ms ease'
                  }}
                >
                  <OptimizedImage
                    src={images[selectedImageIndex]}
                    alt={product.name}
                    width={1000}
                    height={1000}
                    quality={95}
                    className="w-full h-full object-contain pointer-events-none"
                    sizes="(max-width: 640px) 100vw, 600px"
                    priority
                  />
                </div>
              </div>
              
              {/* Preload next and previous images */}
              <div className="hidden" aria-hidden="true">
                {images.length > 1 && [
                  (selectedImageIndex + 1) % images.length,
                  (selectedImageIndex - 1 + images.length) % images.length
                ].map(index => (
                  <OptimizedImage
                    key={index}
                    src={images[index]}
                    alt="Preload"
                    width={1000}
                    height={1000}
                    quality={75}
                    priority={false}
                  />
                ))}
              </div>
            </div>

            {/* Product info section - now part of the main scroll on mobile */}
            <div className="flex-1 md:h-[600px] flex flex-col relative">
              <div className="flex-1 overflow-y-auto pb-[100px] md:pb-4">
                <div className="p-4 space-y-4">
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
                </div>
              </div>

              {/* Fixed buy button container on mobile, normal on desktop */}
              <div className="fixed md:relative bottom-0 left-0 right-0 p-4 bg-gray-900/95 backdrop-blur-sm border-t border-gray-800 md:border-0 md:bg-transparent md:backdrop-blur-none md:p-4">
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
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}