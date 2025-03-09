import React, { useState, useEffect } from 'react';
import { useParams, Navigate } from 'react-router-dom';
import { CategoryTabs } from '../components/collections/CategoryTabs';
import { ProductGrid } from '../components/products/ProductGrid';
import { useCollection } from '../hooks/useCollection';
import { Clock, Image as ImageIcon, Ban } from 'lucide-react';
import { CountdownTimer } from '../components/ui/CountdownTimer';
import { CollectionSkeleton } from '../components/collections/CollectionSkeleton';
import { CollectionNotFound } from '../components/collections/CollectionNotFound';
import { createCategoryIndices } from '../utils/category-mapping';
import { OptimizedImage } from '../ui/OptimizedImage';

export function CollectionPage() {
  const { slug } = useParams();
  const [selectedCategory, setSelectedCategory] = useState<string>();
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  
  const { collection, loading, error } = useCollection(slug || '');

  useEffect(() => {
    if (!loading && isInitialLoad) {
      setIsInitialLoad(false);
    }
  }, [loading]);
  
  if (!slug) {
    return <Navigate to="/" replace />;
  }

  if (loading && isInitialLoad) {
    return <CollectionSkeleton />;
  }

  if (error || !collection) {
    return <CollectionNotFound error={error} />;
  }

  const categoryIndices = createCategoryIndices(collection.categories);
  const isUpcoming = collection.launchDate > new Date();

  // Add launch date and sale status to all products
  const productsWithCollectionData = collection.products.map(product => ({
    ...product,
    collectionLaunchDate: collection.launchDate,
    collectionSaleEnded: collection.sale_ended
  }));

  return (
    <div className={`space-y-6 sm:space-y-8 ${loading && !isInitialLoad ? 'opacity-60' : ''}`}>
      {/* Hero Section */}
      <div className="relative aspect-[21/9] overflow-hidden rounded-xl sm:rounded-2xl">
        {collection.imageUrl ? (
          <OptimizedImage
            src={collection.imageUrl}
            alt={collection.name}
            width={1920}
            height={820}
            quality={85}
            priority={true}
            sizes="100vw"
          />
        ) : (
          <div className="absolute inset-0 bg-gray-800 flex items-center justify-center">
            <ImageIcon className="h-16 w-16 text-gray-600" />
          </div>
        )}
        
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent">
          {(isUpcoming || collection.sale_ended) && (
            <>
              {isUpcoming && (
                <div className="absolute top-4 right-4 sm:top-8 sm:right-8">
                  <CountdownTimer
                    targetDate={collection.launchDate}
                    className="text-base sm:text-xl text-purple-400 bg-black/50 px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg backdrop-blur-sm"
                  />
                </div>
              )}
              <div className="absolute top-4 left-4 sm:top-8 sm:left-8">
                {isUpcoming ? (
                  <div className="flex items-center gap-2 bg-purple-500/90 backdrop-blur-sm text-white px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg">
                    <Clock className="h-4 w-4 sm:h-5 sm:w-5" />
                    <span className="text-sm sm:text-base font-medium">Coming Soon</span>
                  </div>
                ) : collection.sale_ended && (
                  <div className="flex items-center gap-2 bg-red-500/90 backdrop-blur-sm text-white px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg">
                    <Ban className="h-4 w-4 sm:h-5 sm:w-5" />
                    <span className="text-sm sm:text-base font-medium">Sale Ended</span>
                  </div>
                )}
              </div>
            </>
          )}

          <div className="absolute bottom-0 w-full p-4 sm:p-8">
            <h1 className="text-2xl sm:text-4xl md:text-5xl font-bold text-white max-w-2xl">
              {collection.name}
            </h1>
            <p className="text-sm sm:text-base text-gray-300 max-w-xl mt-2 sm:mt-4 line-clamp-2 sm:line-clamp-none">
              {collection.description}
            </p>
          </div>
        </div>
      </div>

      {/* Content Section */}
      <div className="bg-gray-900/50 backdrop-blur-sm rounded-lg">
        {collection.categories.length > 0 && (
          <CategoryTabs
            categories={collection.categories}
            selectedId={selectedCategory}
            onChange={setSelectedCategory}
            categoryIndices={categoryIndices}
          />
        )}

        <div className="p-4 sm:p-6">
          <ProductGrid 
            products={productsWithCollectionData} 
            categoryId={selectedCategory}
            categoryIndices={categoryIndices}
          />
        </div>
      </div>
    </div>
  );
}