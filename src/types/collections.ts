export type AccessType = 'view' | 'edit' | 'admin' | null;

export interface Collection {
  id: string;
  name: string;
  description: string;
  image_url: string;
  imageUrl: string;
  launch_date: string;
  launchDate: Date;
  featured: boolean;
  visible: boolean;
  sale_ended: boolean;
  saleEnded: boolean;
  slug: string;
  user_id: string;
  categories?: any[];
  products?: any[];
  productCount?: number;
  categoryCount?: number;
  accessType: AccessType;
  isOwner: boolean;
  owner_username: string | null;
  collection_access?: CollectionAccess[];
}

export interface CollectionAccess {
  id: string;
  collection_id: string;
  user_id: string;
  access_type: AccessType;
  created_at?: string;
  updated_at?: string;
}

export interface CollectionFormData {
  name: string;
  description: string;
  image?: File;
  launchDate: Date;
  visible: boolean;
} 