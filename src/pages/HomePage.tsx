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
        />
        <BestSellers />
      </section>

      <section>
        <SectionHeader
          title="Coming Soon"
        />
        <CollectionScroller filter="upcoming" />
      </section>

      <section>
        <SectionHeader
          title="Latest Collections"
        />
        <CollectionGrid filter="latest" />
      </section>
    </div>
  );
}