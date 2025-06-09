export interface Collection {
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
  theme_primary_color?: string;
  theme_secondary_color?: string;
  theme_background_color?: string;
  theme_text_color?: string;
  theme_use_custom: boolean;
  theme_use_classic: boolean;
  theme_logo_url?: string;
} 