// Base access type that represents the core permission levels
export type BaseAccessType = 'view' | 'edit';

// Extended access type that includes special roles
export type AccessType = BaseAccessType | 'admin' | 'owner' | null;

// Database collection type (matches the database schema)
export interface DatabaseCollection {
  id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  launch_date: string;
  created_at: string;
  user_id: string;
  featured: boolean;
  visible: boolean;
  sale_ended: boolean;
  slug: string;
  custom_url?: string;
  x_url?: string;
  telegram_url?: string;
  dexscreener_url?: string;
  pumpfun_url?: string;
  website_url?: string;
  free_notes?: string;
  // Theme-related fields
  theme_primary_color?: string | null;
  theme_secondary_color?: string | null;
  theme_background_color?: string | null;
  theme_text_color?: string | null;
  theme_use_custom: boolean;
  theme_use_classic: boolean;
  theme_logo_url?: string | null;
  // Additional fields that might come from the database
  access_type?: AccessType;
  is_owner?: boolean;
  owner_username?: string | null;
  collection_access?: CollectionAccess[];
  categories?: any[];
  products?: any[];
  product_count?: number;
  category_count?: number;
}

// Frontend collection type (used in the UI)
export interface Collection {
  id: string;
  name: string;
  description: string;
  imageUrl: string;
  launchDate: Date;
  featured: boolean;
  visible: boolean;
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
  accessType: AccessType | null;
  isOwner: boolean;
  owner_username: string | null;
  collection_access?: CollectionAccess[];
  
  // Theme settings
  theme_primary_color?: string | null;
  theme_secondary_color?: string | null;
  theme_background_color?: string | null;
  theme_text_color?: string | null;
  theme_use_custom?: boolean;
  theme_use_classic?: boolean;
  theme_logo_url?: string | null;
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
  theme_use_classic?: boolean;
} 