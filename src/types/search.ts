export interface SearchResult {
  id: string;
  name: string;
  description: string;
  imageUrl: string;
  type: 'product' | 'collection' | 'category';
  url: string;
  collection?: {
    id: string;
    name: string;
  };
  category?: {
    id: string;
    name: string;
  };
} 