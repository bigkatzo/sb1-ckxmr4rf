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
    }
  }
} 