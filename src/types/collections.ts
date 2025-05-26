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
  custom_url?: string;
  x_url?: string;
  telegram_url?: string;
  dexscreener_url?: string;
  pumpfun_url?: string;
  website_url?: string;
  free_notes?: string;
  categories?: any[];
  products?: any[];
  productCount?: number;
  categoryCount?: number;
  accessType: AccessType;
  isOwner: boolean;
  owner_username: string | null;
  collection_access?: CollectionAccess[];
  
  // Theme settings
  theme_primary_color?: string;
  theme_secondary_color?: string;
  theme_background_color?: string;
  theme_text_color?: string;
  theme_use_custom?: boolean;
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
  
  // Theme settings
  theme_primary_color?: string;
  theme_secondary_color?: string;
  theme_background_color?: string;
  theme_text_color?: string;
  theme_use_custom?: boolean;
} 