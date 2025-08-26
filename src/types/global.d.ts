interface Window {
  phantom?: {
    solana?: {
      isPhantom?: boolean;
      connect?: () => Promise<{ publicKey: string }>;
      disconnect?: () => Promise<void>;
      signAndSendTransaction?: (transaction: any) => Promise<{ signature: string }>;
      signTransaction?: (transaction: any) => Promise<any>;
      signAllTransactions?: (transactions: any[]) => Promise<any[]>;
      request?: (params: any) => Promise<any>;
    };
  };
  solflare?: {
    isSolflare?: boolean;
    connect?: () => Promise<{ publicKey: string }>;
    disconnect?: () => Promise<void>;
    signAndSendTransaction?: (transaction: any) => Promise<{ signature: string }>;
    signTransaction?: (transaction: any) => Promise<any>;
    signAllTransactions?: (transactions: any[]) => Promise<any[]>;
    request?: (params: any) => Promise<any>;
  };
  backpack?: {
    isBackpack?: boolean;
    connect?: () => Promise<{ publicKey: string }>;
    disconnect?: () => Promise<void>;
    signAndSendTransaction?: (transaction: any) => Promise<{ signature: string }>;
    signTransaction?: (transaction: any) => Promise<any>;
    signAllTransactions?: (transactions: any[]) => Promise<any[]>;
    request?: (params: any) => Promise<any>;
  };
} 