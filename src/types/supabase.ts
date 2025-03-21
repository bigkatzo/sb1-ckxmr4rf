export interface Database {
  public: {
    Tables: {
      collections: {
        Row: {
          id: string;
          name: string;
          description: string;
          image_url: string;
          banner_url: string;
          user_id: string;
          created_at: string;
          updated_at: string;
        };
      };
      categories: {
        Row: {
          id: string;
          name: string;
          description: string;
          type: string;
          visible: boolean;
          order: number;
          collection_id: string;
          eligibility_rules: {
            groups: {
              operator: 'and' | 'or';
              rules: {
                type: 'token' | 'whitelist' | 'nft';
                value: string;
                quantity?: number;
              }[];
            }[];
          };
          created_at: string;
          updated_at: string;
        };
      };
      users: {
        Row: {
          id: string;
          email: string;
          name: string;
          avatar_url: string | null;
          bio: string | null;
          website: string | null;
          twitter: string | null;
          discord: string | null;
          created_at: string;
          updated_at: string;
          role: 'user' | 'admin';
          status: 'active' | 'inactive' | 'banned';
          verified: boolean;
        };
      };
      wallets: {
        Row: {
          id: string;
          address: string;
          label: string | null;
          balance: string;
          active: boolean;
          verified: boolean;
          user_id: string;
          created_at: string;
          updated_at: string;
        };
      };
    };
  };
} 