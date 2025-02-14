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
  tags?: string[];
  user_id: string;
}

export interface CollectionUpdateData extends Omit<CollectionData, 'id' | 'user_id'> {
  removeImage?: boolean;
  currentImageUrl?: string;
}