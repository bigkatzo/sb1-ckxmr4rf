import React from 'react';

export function CollectionSkeleton() {
  return (
    <div className="animate-pulse space-y-8">
      <div className="h-[50vh] sm:h-[70vh] rounded-xl sm:rounded-2xl bg-gray-800" />
      <div className="h-8 w-48 rounded bg-gray-800" />
    </div>
  );
}