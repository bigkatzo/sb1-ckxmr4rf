import { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { X, ChevronLeft, ChevronRight, Clock, Ban } from 'lucide-react';
import { CategoryDescription } from '../collections/CategoryDescription';
import { CompactReviewSection } from '../reviews/CompactReviewSection';
import { VariantDisplay } from './variants/VariantDisplay';
import { ProductVariantPrice } from './ProductVariantPrice';
import { ProductCustomization } from './ProductCustomization';
import { OrderProgressBar } from '../ui/OrderProgressBar';
import { BuyButton } from './BuyButton';
import { OptimizedImage } from '../ui/OptimizedImage';
import { CollectionBadge } from '../ui/CollectionBadge';
import { ShareButton } from '../ui/ShareButton';
import { ProductModalSkeleton } from '../ui/Skeletons';
import { ProductNotes } from './ProductNotes';
import { AddToCartButton } from '../cart/AddToCartButton';
import { CompactCreator } from '../ui/CompactCreator';
import { RichTextDisplay } from '../ui/RichTextDisplay';
import { reviewService } from '../../services/reviews';
import { usePreventScroll } from '../../hooks/usePreventScroll';
import type { Product as BaseProduct } from '../../types/variants';
import type { MerchantTier } from '../../types/collections';
import type { ReviewStats } from '../../types/reviews';
import { preloadImages, preloadGallery } from '../../utils/ImagePreloader';
import { prefetchGallery, updateGalleryImage } from '../../lib/service-worker';
import { validateImageUrl } from '../../utils/imageValidator';
import { FullReviewModal } from '../reviews/FullReviewModal';

// Create a local Set to track preloaded images for this component instance
const preloadedImages = new Set<string>();

// Extend the base Product type with additional properties needed for the modal
interface Product extends BaseProduct {
  collectionLaunchDate?: Date;
  collectionSaleEnded?: boolean;
  categorySaleEnded?: boolean;
  notes?: {
    shipping?: string;
    quality?: string;
    returns?: string;
  };
  freeNotes?: string;
  saleEnded?: boolean;
  collectionOwnerMerchantTier?: MerchantTier;
  collectionUserId?: string;
}

interface CustomizationData {
  image?: File | null;
  text?: string;
  imagePreview?: string;
  imageBase64?: string;
}

interface ProductModalProps {
  product: Product;
  onClose: () => void;
  categoryIndex: number;
  loading?: boolean;
}

// Helper component for buy button to avoid duplication
function ProductBuyButton({ 
  product, 
  selectedOptions, 
  customizationData,
  hasVariants, 
  isUpcoming, 
  isSaleEnded, 
  allOptionsSelected,
  isCustomizationValid
}: { 
  product: Product; 
  selectedOptions: Record<string, string>; 
  customizationData: CustomizationData;
  hasVariants: boolean; 
  isUpcoming: boolean; 
  isSaleEnded: boolean; 
  allOptionsSelected: boolean;
  isCustomizationValid: boolean;
}) {
  if (isUpcoming) {
    return (
      <button 
        disabled
        className="w-full flex items-center justify-center gap-2 bg-gray-800/80 backdrop-blur-sm text-gray-400 px-4 py-3 rounded-lg cursor-not-allowed transition-colors text-sm sm:text-base"
      >
        <Clock className="h-4 w-4 sm:h-5 sm:w-5" />
        <span>Coming Soon</span>
      </button>
    );
  }
  
  if (isSaleEnded) {
    return (
      <button 
        disabled
        className="w-full flex items-center justify-center gap-2 bg-red-900/20 backdrop-blur-sm text-red-400 px-4 py-3 rounded-lg cursor-not-allowed transition-colors text-sm sm:text-base"
      >
        <Ban className="h-4 w-4 sm:h-5 sm:w-5" />
        <span>Sale Ended</span>
      </button>
    );
  }
  
  // Update the disabled condition to handle null stock as unlimited
  const isDisabled = (product.stock !== null && product.stock === 0) || (hasVariants && !allOptionsSelected);

  return (
    <div className="flex gap-2 w-full">
      <BuyButton
        product={product}
        selectedOptions={selectedOptions}
        customizationData={customizationData}
        disabled={isDisabled}
        className="flex-1 flex items-center justify-center gap-2 py-3 text-sm sm:text-base"
        showModal={true}
      />
      
      <AddToCartButton
        product={product}
        selectedOptions={selectedOptions}
        customizationData={customizationData}
        disabled={isDisabled}
        size="md"
        className="px-3 py-3"
        isCustomizationValid={isCustomizationValid}
      />
    </div>
  );
}

export function ProductModal({ product, onClose, categoryIndex, loading = false }: ProductModalProps) {
  // If loading, show skeleton
  if (loading) {
    return <ProductModalSkeleton />;
  }
  
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>({});
  const [customizationData, setCustomizationData] = useState<CustomizationData>({});
  const [isCustomizationValid, setIsCustomizationValid] = useState(true);
  const [reviewStats, setReviewStats] = useState<ReviewStats | null>(product.reviewStats || null);
  const [loadingReviews, setLoadingReviews] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);
  const images = product.images?.length ? product.images : [product.imageUrl];
  const [touchStart, setTouchStart] = useState<{ x: number; y: number } | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState(0);
  const [dragStartTime, setDragStartTime] = useState(0);
  const [dragVelocity, setDragVelocity] = useState(0);
  const [scrollDirection, setScrollDirection] = useState<'horizontal' | 'vertical' | null>(null);
  const isAnimating = useRef(false);
  const [showReviewModal, setShowReviewModal] = useState(false);

  // Use standardized scroll prevention
  usePreventScroll(true);
  
  // Required minimum swipe distance in pixels
  const minSwipeDistance = 50;
  // Velocity threshold for momentum scrolling (pixels per millisecond)
  const velocityThreshold = 0.5;
  // Angle threshold for determining vertical vs horizontal movement (in degrees)
  const angleThreshold = 30;
  
  // Safe check for variants
  const hasVariants = !!product.variants && product.variants.length > 0;

  // Initialize service worker gallery prefetching
  useEffect(() => {
    if (images.length <= 1) return;
    
    // Use the new service worker prefetching implementation 
    prefetchGallery(product.id || product.slug, images, selectedImageIndex);
    
    // Also use the client-side preloader for immediate benefit
    // This provides a dual-approach ensuring optimal experience
    preloadGallery(images, selectedImageIndex, 2);
  }, [product.id, product.slug, images]);
  
  // Update service worker when selected image changes
  useEffect(() => {
    if (images.length <= 1) return;
    
    // Inform service worker about image change for priority adjustment
    updateGalleryImage(product.id || product.slug, selectedImageIndex);
    
    // Also update client-side preloader
    preloadGallery(images, selectedImageIndex, 2);
  }, [selectedImageIndex, product.id, product.slug, images.length]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  // Add handler for browser back button
  useEffect(() => {
    const handlePopState = () => {
      onClose();
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [onClose]);

  // Load review stats when modal opens
  useEffect(() => {
    if (!reviewStats && !loadingReviews) {
      setLoadingReviews(true);
      reviewService.getProductStats(product.id)
        .then(stats => {
          setReviewStats(stats);
        })
        .catch(error => {
          console.error('Failed to load review stats:', error);
          // Set empty stats on error so we don't keep retrying
          setReviewStats({
            totalReviews: 0,
            averageRating: 0,
            ratingDistribution: { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 }
          });
        })
        .finally(() => {
          setLoadingReviews(false);
        });
    }
  }, [product.id, reviewStats, loadingReviews]);

  // Cleanup effect for customization image preview URLs
  useEffect(() => {
    return () => {
      if (customizationData.imagePreview) {
        URL.revokeObjectURL(customizationData.imagePreview);
      }
    };
  }, []); // Only run on unmount

  const handleOptionChange = (variantId: string, value: string) => {
    setSelectedOptions(prev => ({
      ...prev,
      [variantId]: value
    }));
  };

  const handleCustomizationChange = (data: CustomizationData) => {
    setCustomizationData(data);
  };

  const handleCustomizationValidationChange = (isValid: boolean) => {
    setIsCustomizationValid(isValid);
  };

  // Touch handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    if (isAnimating.current) return;
    
    const touch = e.targetTouches[0];
    setTouchStart({ x: touch.clientX, y: touch.clientY });
    setTouchEnd(null);
    setIsDragging(true);
    setDragOffset(0);
    setDragStartTime(Date.now());
    setScrollDirection(null);
    isAnimating.current = false;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!touchStart || !isDragging) return;
    
    const touch = e.targetTouches[0];
    const touchDeltaX = touch.clientX - touchStart.x;
    const touchDeltaY = touch.clientY - touchStart.y;
    
    // Calculate angle of movement
    const angle = Math.abs(Math.atan2(touchDeltaY, touchDeltaX) * 180 / Math.PI);
    
    // Determine scroll direction if not already set
    if (!scrollDirection) {
      if (angle > 90 - angleThreshold && angle < 90 + angleThreshold) {
        setScrollDirection('vertical');
      } else {
        setScrollDirection('horizontal');
      }
    }
    
    // Only handle horizontal scrolling if that's the determined direction
    if (scrollDirection === 'horizontal') {
      e.preventDefault();
      
      // Add resistance at the edges with smoother transition
      if ((selectedImageIndex === 0 && touchDeltaX > 0) || 
          (selectedImageIndex === images.length - 1 && touchDeltaX < 0)) {
        setDragOffset(touchDeltaX * 0.2); // Reduced resistance for smoother feel
      } else {
        setDragOffset(touchDeltaX * 0.8); // Add slight resistance for smoother movement
      }
      
      setTouchEnd(touch.clientX);
    }
  };

  const handleTouchEnd = useCallback(() => {
    if (!touchStart || !touchEnd || !isDragging) return;

    const distance = touchEnd - touchStart.x;
    const isLeftSwipe = distance < -minSwipeDistance;
    const isRightSwipe = distance > minSwipeDistance;
    
    // Calculate velocity for momentum scrolling
    const endTime = Date.now();
    const duration = endTime - dragStartTime;
    const velocity = Math.abs(distance) / duration;
    setDragVelocity(velocity);
    
    isAnimating.current = true;
    
    if (scrollDirection === 'horizontal' && (isLeftSwipe || (velocity > velocityThreshold && distance < 0))) {
      nextImage();
    } else if (scrollDirection === 'horizontal' && (isRightSwipe || (velocity > velocityThreshold && distance > 0))) {
      prevImage();
    } else {
      // Snap back to current slide with smooth transition
      setDragOffset(0);
      setTimeout(() => {
        isAnimating.current = false;
      }, 50);
    }

    setTouchStart(null);
    setTouchEnd(null);
    setIsDragging(false);
    setScrollDirection(null);
  }, [touchStart, touchEnd, dragStartTime, isDragging, images.length, scrollDirection]);

  // Mouse drag handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (isAnimating.current) return;
    
    setTouchStart({ x: e.clientX, y: e.clientY });
    setTouchEnd(null);
    setIsDragging(true);
    setDragOffset(0);
    setDragStartTime(Date.now());
    isAnimating.current = false;
    
    // Add event listeners to document to track mouse movement even outside the slider
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    
    // Prevent default to avoid text selection during drag
    e.preventDefault();
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!touchStart || !isDragging) return;
    
    // Prevent default to ensure smooth dragging
    e.preventDefault();
    
    const diff = e.clientX - touchStart.x;
    
    // Add resistance at the edges
    if ((selectedImageIndex === 0 && diff > 0) || 
        (selectedImageIndex === images.length - 1 && diff < 0)) {
      setDragOffset(diff * 0.3); // Apply resistance
    } else {
      setDragOffset(diff);
    }
  }, [isDragging, selectedImageIndex, images.length, touchStart]);

  const handleMouseUp = useCallback((e: MouseEvent) => {
    if (!touchStart || !isDragging) return;
    
    const distance = e.clientX - touchStart.x;
    const isLeftSwipe = distance < -minSwipeDistance;
    const isRightSwipe = distance > minSwipeDistance;
    
    // Calculate velocity for momentum scrolling
    const endTime = Date.now();
    const duration = endTime - dragStartTime;
    const velocity = Math.abs(distance) / duration;
    setDragVelocity(velocity);
    
    isAnimating.current = true;
    
    if (isLeftSwipe || (velocity > velocityThreshold && distance < 0)) {
      nextImage();
    } else if (isRightSwipe || (velocity > velocityThreshold && distance > 0)) {
      prevImage();
    } else {
      // Snap back to current slide if swipe wasn't strong enough
      setDragOffset(0);
      setTimeout(() => {
        isAnimating.current = false;
      }, 50);
    }
    
    setTouchStart(null);
    setTouchEnd(null);
    setIsDragging(false);
    
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
  }, [isDragging, dragStartTime, images.length, touchStart]);

  // Cleanup mouse events on unmount
  useEffect(() => {
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]);

  // Initialize touch event listeners
  useEffect(() => {
    const imageContainer = modalRef.current?.querySelector('.image-container');
    if (imageContainer) {
      const passiveListener = { passive: false };
      imageContainer.addEventListener('touchstart', handleTouchStart as unknown as EventListener, passiveListener);
      imageContainer.addEventListener('touchmove', handleTouchMove as unknown as EventListener, passiveListener);
      imageContainer.addEventListener('touchend', handleTouchEnd as unknown as EventListener);
      imageContainer.addEventListener('touchcancel', handleTouchEnd as unknown as EventListener);
    }
    
    return () => {
      if (imageContainer) {
        imageContainer.removeEventListener('touchstart', handleTouchStart as unknown as EventListener);
        imageContainer.removeEventListener('touchmove', handleTouchMove as unknown as EventListener);
        imageContainer.removeEventListener('touchend', handleTouchEnd as unknown as EventListener);
        imageContainer.removeEventListener('touchcancel', handleTouchEnd as unknown as EventListener);
      }
    };
  }, [handleTouchEnd]);

  const nextImage = () => {
    isAnimating.current = true;
    setSelectedImageIndex((prev) => (prev + 1) % images.length);
    setDragOffset(0);
    setTimeout(() => {
      isAnimating.current = false;
    }, 50);
  };

  const prevImage = () => {
    isAnimating.current = true;
    setSelectedImageIndex((prev) => (prev - 1 + images.length) % images.length);
    setDragOffset(0);
    setTimeout(() => {
      isAnimating.current = false;
    }, 50);
  };

  // Calculate transition speed based on velocity for momentum effect
  const transitionDuration = isDragging ? 0 : (dragVelocity > velocityThreshold ? 250 : 400);
  
  // Apply a slight damping effect to make the drag feel more natural
  const dampingFactor = 0.92;
  
  const translateX = isDragging 
    ? -(selectedImageIndex * 100) + (dragOffset * dampingFactor / (modalRef.current?.clientWidth || window.innerWidth) * 100)
    : -(selectedImageIndex * 100);

  // Filter out customization variants from regular variants
  const customizationFields = ['Image Customization', 'Text Customization'];
  const regularVariants = hasVariants 
    ? product.variants!.filter((variant: { name: string }) => !customizationFields.includes(variant.name))
    : [];

  // Check if all regular variants are selected
  const allRegularVariantsSelected = regularVariants.length === 0 || 
    regularVariants.every((variant: { id: string }) => selectedOptions[variant.id]);

  // Determine final allOptionsSelected based on customization requirements
  let allOptionsSelected = allRegularVariantsSelected;
  
  if (product.isCustomizable === 'mandatory') {
    // For mandatory customization, also require customization to be valid
    allOptionsSelected = allRegularVariantsSelected && isCustomizationValid;
  } else if (product.isCustomizable === 'optional') {
    // For optional customization, only require regular variants
    allOptionsSelected = allRegularVariantsSelected;
  }
  // For 'no' customization, only regular variants matter (already handled above)

  // Product state variables - extract at the component level
  const isUpcoming = product.collectionLaunchDate ? new Date(product.collectionLaunchDate) > new Date() : false;
  const isSaleEnded = product.saleEnded || product.collectionSaleEnded || product.categorySaleEnded;

  // Focused preloading effect with immediate first image load
  useEffect(() => {
    if (!images.length) return;
    
    // Use the smart gallery preloader to prioritize images properly
    // Add immediate adjacent images to high priority preloading
    preloadGallery(images, selectedImageIndex, 2);
    
    // Directly preload the next image with high priority when available
    if (selectedImageIndex + 1 < images.length) {
      const nextImg = new Image();
      nextImg.src = images[selectedImageIndex + 1];
      nextImg.fetchPriority = 'high';
    }
    
    // Also preload the previous image with slightly lower priority when available
    if (selectedImageIndex > 0) {
      const prevImg = new Image();
      prevImg.src = images[selectedImageIndex - 1];
      // Use a slightly lower priority for the previous image
      prevImg.fetchPriority = 'auto';
    }
  }, [selectedImageIndex, images]);

  // Preload all images when the modal first opens for a complete gallery experience
  useEffect(() => {
    if (!images.length) return;
    
    // Preload the visible image immediately with highest priority
    if (images[selectedImageIndex]) {
      const visibleImg = new Image();
      visibleImg.src = images[selectedImageIndex];
      visibleImg.fetchPriority = 'high';
      
      // Add a preload link to ensure browser fetches this immediately
      const link = document.createElement('link');
      link.rel = 'preload';
      link.as = 'image';
      link.href = images[selectedImageIndex];
      link.fetchPriority = 'high';
      link.crossOrigin = 'anonymous';
      document.head.appendChild(link);
      
      // Remove the preload link after image is loaded or after a timeout
      const cleanup = () => {
        if (document.head.contains(link)) {
          document.head.removeChild(link);
        }
      };
      
      visibleImg.onload = cleanup;
      visibleImg.onerror = cleanup;
      // Fallback cleanup in case onload never fires
      setTimeout(cleanup, 3000);
    }
    
    // Use intersection observer API for better loading of offscreen images
    // This creates a more progressive loading experience than requestIdleCallback
    if ('IntersectionObserver' in window) {
      const imageLoaderCallback = (entries: IntersectionObserverEntry[], observer: IntersectionObserver) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const index = parseInt(entry.target.getAttribute('data-index') || '-1');
            if (index >= 0 && index < images.length) {
              // Preload this specific image
              const img = new Image();
              img.src = images[index];
              preloadedImages.add(images[index]);
              // Unobserve after loading
              observer.unobserve(entry.target);
            }
          }
        });
      };
      
      // Create low-threshold observer to start loading before images are fully visible
      const imageObserver = new IntersectionObserver(imageLoaderCallback, {
        rootMargin: '500px', // Larger margin to start loading even earlier
        threshold: 0.01 // Trigger with just 1% in view
      });
      
      // Observe placeholder elements for all gallery images
      // Use requestAnimationFrame to ensure the DOM is ready
      requestAnimationFrame(() => {
        const placeHolders = document.querySelectorAll('.gallery-image-placeholder');
        if (placeHolders && placeHolders.length > 0) {
          placeHolders.forEach((placeholder) => {
            imageObserver.observe(placeholder);
          });
        } else {
          // Fallback if placeholders aren't found
          setTimeout(() => preloadImages(images), 200);
        }
      });
      
      return () => {
        imageObserver.disconnect();
      };
    } else {
      // Fallback for browsers without IntersectionObserver
      // Preload all other images during idle time
      if ('requestIdleCallback' in window) {
        (window as any).requestIdleCallback(() => {
          // Gradually preload all images
          preloadImages(images);
        });
      } else {
        // Fallback for browsers without requestIdleCallback
        setTimeout(() => {
          preloadImages(images);
        }, 300);
      }
    }
  }, [images]);

  // Validate image URLs when modal opens and when images change
  useEffect(() => {
    // Allow a brief delay for images to load into the DOM
    const timer = setTimeout(() => {
      // Validate each image URL in the gallery
      images.forEach(imgUrl => validateImageUrl(imgUrl));
      
      // Also specifically check gallery image placeholders
      document.querySelectorAll('.gallery-image-placeholder').forEach(placeholder => {
        const index = placeholder.getAttribute('data-index');
        if (index !== null && images[parseInt(index)]) {
          const imgUrl = images[parseInt(index)];
          if (imgUrl && imgUrl.includes('/storage/v1/object/public/')) {
            // Fix the image URL in the images array
            images[parseInt(index)] = imgUrl.replace(
              '/storage/v1/object/public/', 
              '/storage/v1/render/image/public/'
            );
            console.warn(`Fixed gallery placeholder image at index ${index}`);
          }
        }
      });
    }, 300);
    
    return () => clearTimeout(timer);
  }, [images]);

  return (
    <div 
      className="fixed inset-0 z-[45] overflow-y-auto overscroll-contain" 
      aria-modal="true" 
      role="dialog"
      aria-labelledby="modal-title"
    >
      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[40]" onClick={onClose} />

      <div className="min-h-screen w-full flex items-start justify-center p-0 pt-14 sm:p-4 sm:pt-16 sm:items-center">
        <div 
          ref={modalRef}
          className="relative w-full min-h-[calc(100vh-56px)] sm:min-h-0 sm:h-auto sm:max-h-[90vh] sm:w-[800px] sm:max-w-5xl sm:rounded-xl overflow-hidden z-[45]"
          style={{ backgroundColor: 'var(--color-card-background)' }}
        >
          <div className="absolute top-4 right-4 z-[46] flex items-center gap-2">
            <ShareButton 
              url={product.collectionSlug && product.slug ? `${window.location.origin}/${product.collectionSlug}/${product.slug}` : undefined}
              title={`${product.name} | ${product.collectionName || 'store.fun'}`}
              size="md"
              className="bg-black/50 hover:bg-black/70"
            />
            <button
              onClick={onClose}
              className="p-2 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors"
              aria-label="Close modal"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Mobile: Single scroll container, Desktop: Grid layout */}
          <div className="min-h-screen sm:min-h-0 sm:h-auto md:grid md:grid-cols-2">
            <div 
              className="w-full aspect-square md:aspect-auto md:h-[600px] relative overflow-hidden"
              style={{ backgroundColor: 'var(--color-background)' }}
            >
              {/* Fixed navigation arrows */}
              {images.length > 1 && (
                <>
                  <button
                    onClick={prevImage}
                    className="absolute left-4 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors z-[41] hidden md:flex"
                    aria-label="Previous image"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                  <button
                    onClick={nextImage}
                    className="absolute right-4 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors z-[41] hidden md:flex"
                    aria-label="Next image"
                  >
                    <ChevronRight className="h-5 w-5" />
                  </button>

                  <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-2 z-[41]">
                    {images.map((_: string, index: number) => (
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

              {/* Image container - consistent for both single and multiple images */}
              <div 
                className="absolute inset-0 select-none image-container"
                onMouseDown={handleMouseDown}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
                onTouchCancel={handleTouchEnd}
              >
                <div
                  className="h-full flex transform-gpu"
                  style={images.length > 1 ? {
                    transform: `translate3d(${translateX}%, 0, 0)`,
                    transition: isDragging ? 'none' : `transform ${transitionDuration}ms cubic-bezier(0.2, 0.82, 0.2, 1)`,
                    backfaceVisibility: 'hidden',
                    WebkitBackfaceVisibility: 'hidden'
                  } : {
                    justifyContent: 'center',
                    alignItems: 'center'
                  }}
                >
                  {images.map((image: string, index: number) => (
                    <div
                      key={index}
                      className={`${images.length > 1 ? 'w-full flex-shrink-0' : ''} h-full flex items-center justify-center`}
                      style={images.length > 1 ? {
                        transform: 'translate3d(0, 0, 0)',
                        willChange: 'transform',
                        backfaceVisibility: 'hidden',
                        WebkitBackfaceVisibility: 'hidden'
                      } : { width: '100%' }}
                    >
                      <div 
                        className="gallery-image-placeholder absolute inset-0 pointer-events-none opacity-0" 
                        data-index={index}
                        aria-hidden="true"
                      ></div>
                      <OptimizedImage
                        src={image}
                        alt={`${product.name}${images.length > 1 ? ` - Image ${index + 1}` : ''}`}
                        width={1000}
                        height={1000}
                        quality={95}
                        priority={index === selectedImageIndex}
                        inViewport={
                          index === selectedImageIndex || 
                          index === (selectedImageIndex + 1) % images.length || 
                          index === (selectedImageIndex - 1 + images.length) % images.length
                        }
                        fetchPriority={
                          index === selectedImageIndex 
                            ? 'high' 
                            : (index === selectedImageIndex + 1 || index === selectedImageIndex - 1) 
                              ? 'auto' 
                              : 'low'
                        }
                        loading={
                          index === selectedImageIndex || 
                          index === (selectedImageIndex + 1) % images.length || 
                          index === (selectedImageIndex - 1 + images.length) % images.length 
                            ? 'eager' 
                            : 'lazy'
                        }
                        className="max-w-full max-h-full w-auto h-auto object-contain pointer-events-none"
                        sizes="(max-width: 640px) 100vw, 800px"
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Product info section - now part of the main scroll on mobile */}
            <div className="flex-1 md:h-[600px] flex flex-col relative">
              <div className="flex-1 overflow-y-auto pb-[120px] md:pb-4">
                <div className="p-4 space-y-4">
                  {product.collectionSlug && product.collectionName && (
                    <Link
                      to={`/${product.collectionSlug}${window.location.search}`}
                      onClick={onClose}
                      className="flex items-center gap-1.5 text-sm transition-colors"
                      style={{ 
                        color: 'var(--color-text-muted)',
                        '--hover-color': 'var(--color-secondary)'
                      } as React.CSSProperties}
                      onMouseEnter={(e) => e.currentTarget.style.color = 'var(--color-secondary)'}
                      onMouseLeave={(e) => e.currentTarget.style.color = 'var(--color-text-muted)'}
                    >
                      <span>{product.collectionName}</span>
                      <CollectionBadge 
                        merchantTier={product.collectionOwnerMerchantTier} 
                        className="text-base"
                        showTooltip={true}
                      />
                    </Link>
                  )}

                  <div>
                    <h2 
                      id="modal-title" 
                      className="text-xl font-bold"
                      style={{ color: 'var(--color-text)' }}
                    >
                      {product.name}
                    </h2>
                    <div 
                      className="mt-2 text-sm"
                      style={{ color: 'var(--color-text-muted)' }}
                    >
                      <RichTextDisplay content={product.description} />
                    </div>
                  </div>

                  {hasVariants && (
                    <VariantDisplay
                      variants={product.variants!}
                      selectedOptions={selectedOptions}
                      onChange={handleOptionChange}
                    />
                  )}

                  {/* Product Customization Component */}
                  <ProductCustomization
                    customization={product.customization || { image: false, text: false }}
                    isCustomizable={product.isCustomizable || 'no'}
                    customizationData={customizationData}
                    onChange={handleCustomizationChange}
                    onValidationChange={handleCustomizationValidationChange}
                  />

                  <ProductVariantPrice
                    product={product}
                    selectedOptions={selectedOptions}
                  />

                  {/* Buy button for desktop - static position */}
                  <div className="hidden md:block">
                    <ProductBuyButton
                      product={product}
                      selectedOptions={selectedOptions}
                      customizationData={customizationData}
                      hasVariants={!!hasVariants}
                      isUpcoming={!!isUpcoming}
                      isSaleEnded={!!isSaleEnded}
                      allOptionsSelected={!!allOptionsSelected}
                      isCustomizationValid={isCustomizationValid}
                    />
                  </div>

                  <OrderProgressBar
                    productId={product.id}
                    minimumOrderQuantity={product.minimumOrderQuantity || 50}
                    maxStock={product.stock}
                    isMainView={true}
                    priceModifierBeforeMin={product.priceModifierBeforeMin || null}
                    priceModifierAfterMin={product.priceModifierAfterMin || null}
                  />

                  {product.category && (
                    <div 
                      className="border-t pt-4"
                      style={{ borderColor: 'var(--color-card-background)' }}
                    >
                      <h3 
                        className="text-sm font-medium mb-2"
                        style={{ color: 'var(--color-text)' }}
                      >
                        Category & Eligibility
                      </h3>
                      <div 
                        className="rounded-lg p-3"
                        style={{ backgroundColor: 'var(--color-background)' }}
                      >
                        <CategoryDescription 
                          category={product.category} 
                          categoryIndex={categoryIndex}
                        />
                      </div>
                    </div>
                  )}

                  <ProductNotes 
                    notes={product.notes} 
                    freeNotes={typeof product.freeNotes === 'string' ? product.freeNotes : ''}
                  />

                  {/* Creator Section */}
                  {product.collectionUserId && (
                    <CompactCreator 
                      userId={product.collectionUserId}
                    />
                  )}

                  {/* Review Section */}
                  <div className="border-t pt-4 mt-4" style={{ borderColor: 'var(--color-card-background)' }}>
                    <h3 
                      className="text-sm font-medium mb-3"
                      style={{ color: 'var(--color-text)' }}
                    >
                      Customer Reviews
                    </h3>
                    {loadingReviews ? (
                      <div className="flex items-center justify-center py-8">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-secondary"></div>
                      </div>
                    ) : reviewStats ? (
                      <>
                        <CompactReviewSection 
                          stats={reviewStats}
                          onClick={() => setShowReviewModal(true)}
                        />
                        <FullReviewModal
                          isOpen={showReviewModal}
                          onClose={() => setShowReviewModal(false)}
                          productId={product.id}
                          stats={reviewStats}
                        />
                      </>
                    ) : (
                      <div className="text-gray-400 text-sm py-4">
                        No reviews yet. Be the first to review this product!
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Buy button for mobile - fixed position */}
              <div 
                className="fixed md:hidden bottom-0 left-0 right-0 p-4 backdrop-blur-sm border-t z-[47] safe-area-bottom"
                style={{ 
                  backgroundColor: 'rgba(var(--color-card-background-rgb), 0.95)',
                  borderColor: 'var(--color-card-background)' 
                }}
              >
                <ProductBuyButton
                  product={product}
                  selectedOptions={selectedOptions}
                  customizationData={customizationData}
                  hasVariants={!!hasVariants}
                  isUpcoming={!!isUpcoming}
                  isSaleEnded={!!isSaleEnded}
                  allOptionsSelected={!!allOptionsSelected}
                  isCustomizationValid={isCustomizationValid}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}