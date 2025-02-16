export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      user_profiles: {
        Row: {
          id: string
          role: 'admin' | 'merchant' | 'user'
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          role: 'admin' | 'merchant' | 'user'
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          role?: 'admin' | 'merchant' | 'user'
          created_at?: string
          updated_at?: string
        }
      }
    }
    Functions: {
      list_users: {
        Args: Record<string, never>
        Returns: Array<{
          id: string
          email: string
          role: string
          created_at: string
        }>
      }
    }
  }
} 