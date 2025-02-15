import React from 'react';
import { CollectionScroller } from '../components/collections/CollectionScroller';
import { CollectionGrid } from '../components/collections/CollectionGrid';
import { FeaturedCollection } from '../components/collections/FeaturedCollection';
import { BestSellers } from '../components/products/BestSellers';
import { SectionHeader } from '../components/ui/SectionHeader';

export function HomePage() {
  return (
    <div className="space-y-8 sm:space-y-12 scroll-smooth">
      <FeaturedCollection />
      
      <section>
        <SectionHeader
          title="Best Sellers"
          description="Most popular items from our collections"
        />
        <BestSellers />
      </section>

      <section>
        <SectionHeader
          title="Coming Soon"
          description="Exclusive drops launching soon"
        />
        <CollectionScroller filter="upcoming" />
      </section>

      <section>
        <SectionHeader
          title="Latest Collections"
          description="Fresh drops ready to explore"
        />
        <CollectionGrid filter="latest" />
      </section>
    </div>
  );
}