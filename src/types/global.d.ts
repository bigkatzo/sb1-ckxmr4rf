interface Window {
  phantom?: {
    solana?: {
      isPhantom?: boolean;
      connect?: () => Promise<{ publicKey: string }>;
      disconnect?: () => Promise<void>;
    };
  };
} 