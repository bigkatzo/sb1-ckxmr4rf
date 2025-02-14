import React from 'react';
import { Link } from 'react-router-dom';
import { Clock, ArrowRight, Image as ImageIcon, Ban } from 'lucide-react';
import type { Collection } from '../../types';

interface CollectionCardProps {
  collection: Collection;
  variant?: 'default' | 'large';
}

export function CollectionCard({ collection, variant = 'default' }: CollectionCardProps) {
  const now = new Date();
  const isUpcoming = collection.launchDate > now;
  const isNew = !isUpcoming && (now.getTime() - collection.launchDate.getTime()) < 7 * 24 * 60 * 60 * 1000;

  const isLarge = variant === 'large';
  const aspectRatio = isLarge ? 'aspect-[16/10]' : 'aspect-[4/3]';

  return (
    <div className={`
      group relative block overflow-hidden rounded-lg sm:rounded-xl 
      transition-all hover:ring-2 hover:ring-purple-500/50 hover:-translate-y-0.5 
      bg-gray-900 w-full
    `}>
      <div className={`relative ${aspectRatio} w-full overflow-hidden`}>
        {collection.imageUrl ? (
          <img
            src={collection.imageUrl}
            alt={collection.name}
            className="h-full w-full object-cover transition-transform duration-300 will-change-transform group-hover:scale-105"
          />
        ) : (
          <div className="h-full w-full bg-gray-800 flex items-center justify-center">
            <ImageIcon className="h-6 w-6 sm:h-8 sm:w-8 md:h-12 md:w-12 text-gray-600" />
          </div>
        )}
        
        <div className="absolute inset-0 bg-gradient-to-t from-gray-900/90 via-gray-900/25 to-transparent">
          {(isUpcoming || isNew || collection.sale_ended) && (
            <div className="absolute inset-x-0 bottom-2 sm:bottom-3 flex justify-center">
              <div className="flex items-center gap-1.5 sm:gap-2">
                {isUpcoming && (
                  <span className="inline-flex items-center rounded-full bg-purple-500/90 backdrop-blur-sm px-2 py-0.5 text-[10px] sm:text-xs font-medium shadow-lg">
                    <Clock className="mr-1 h-2.5 w-2.5 sm:h-3 sm:w-3" />
                    Coming Soon
                  </span>
                )}
                {isNew && (
                  <span className="inline-flex items-center rounded-full bg-green-500/90 backdrop-blur-sm px-2 py-0.5 text-[10px] sm:text-xs font-medium shadow-lg">
                    New Drop
                  </span>
                )}
                {collection.sale_ended && (
                  <span className="inline-flex items-center rounded-full bg-red-500/90 backdrop-blur-sm px-2 py-0.5 text-[10px] sm:text-xs font-medium shadow-lg">
                    <Ban className="mr-1 h-2.5 w-2.5 sm:h-3 sm:w-3" />
                    Sale Ended
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
      
      <div className="p-3">
        <h3 className={`
          font-semibold text-white line-clamp-1 
          group-hover:text-purple-400 transition-colors
          ${isLarge ? 'text-sm sm:text-base' : 'text-xs sm:text-sm'}
        `}>
          {collection.name}
        </h3>
        
        <p className={`
          text-gray-400 line-clamp-2 mt-1
          ${isLarge ? 'text-xs sm:text-sm' : 'text-[10px] sm:text-xs'}
        `}>
          {collection.description}
        </p>
        
        <div className={`
          flex items-center justify-between
          ${isLarge ? 'mt-3 sm:mt-4' : 'mt-2 sm:mt-3'}
        `}>
          {isUpcoming ? (
            <div className="flex items-center text-purple-400/90">
              <Clock className="mr-1.5 h-3 w-3 sm:h-4 sm:w-4" />
              <span className={isLarge ? 'text-xs sm:text-sm' : 'text-[10px] sm:text-xs'}>
                {collection.launchDate.toLocaleDateString()}
              </span>
            </div>
          ) : (
            <div className="flex items-center text-purple-400/90 group-hover:text-purple-400 transition-colors">
              <span className={isLarge ? 'text-xs sm:text-sm' : 'text-[10px] sm:text-xs'}>
                Browse Collection
              </span>
              <ArrowRight className={`
                ml-1.5 transition-transform group-hover:translate-x-0.5
                ${isLarge ? 'h-3.5 w-3.5 sm:h-4 sm:w-4' : 'h-3 w-3 sm:h-3.5 sm:w-3.5'}
              `} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}