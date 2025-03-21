export type UserRole = 'admin' | 'merchant' | 'user';

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  avatar_url?: string;
  bio?: string;
  website?: string;
  twitter?: string;
  discord?: string;
  created_at: string;
  updated_at: string;
  role: 'user' | 'admin';
  status: 'active' | 'inactive' | 'banned';
  verified: boolean;
} 