export type AccessType = 'view' | 'edit' | null;

export interface Collection {
  id: string;
  name: string;
  description: string;
  image_url?: string;
  imageUrl?: string;
  launch_date: string | Date;
  launchDate: Date;
  featured: boolean;
  visible: boolean;
  sale_ended: boolean;
  saleEnded: boolean;
  slug: string;
  user_id: string;
  categories: any[];
  products: any[];
  accessType: AccessType;
  collection_access?: CollectionAccess[];
}

export interface CollectionAccess {
  id: string;
  collection_id: string;
  user_id: string;
  access_type: Exclude<AccessType, null>;
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