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
      collections: {
        Row: {
          id: string
          user_id: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
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
      manage_user_role: {
        Args: {
          p_user_id: string
          p_role: 'admin' | 'merchant' | 'user'
        }
        Returns: void
      }
      change_user_password: {
        Args: {
          p_user_id: string
          p_new_password: string
        }
        Returns: void
      }
      delete_user: {
        Args: {
          p_user_id: string
        }
        Returns: void
      }
      check_database_connection: {
        Args: Record<string, never>
        Returns: boolean
      }
      is_admin: {
        Args: Record<string, never>
        Returns: boolean
      }
      create_user_with_username: {
        Args: {
          p_username: string
          p_password: string
          p_role?: 'admin' | 'merchant' | 'user'
        }
        Returns: string
      }
    }
    Enums: {
      user_role: 'admin' | 'merchant' | 'user'
    }
  }
} 