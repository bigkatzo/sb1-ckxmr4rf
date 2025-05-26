export interface CollectionData {
  id: string;
  name: string;
  description: string;
  image_url?: string | null;
  launch_date: string;
  slug: string;
  visible: boolean;
  featured?: boolean;
  sale_ended: boolean;
  custom_url?: string;
  x_url?: string;
  telegram_url?: string;
  dexscreener_url?: string;
  pumpfun_url?: string;
  website_url?: string;
  free_notes?: string;
  tags?: string[];
  user_id: string;
  
  // Theme settings
  theme_primary_color?: string;
  theme_secondary_color?: string;
  theme_background_color?: string;
  theme_text_color?: string;
  theme_use_custom?: boolean;
}

export interface CollectionUpdateData extends Omit<CollectionData, 'id' | 'user_id'> {
  removeImage?: boolean;
  currentImageUrl?: string;
}