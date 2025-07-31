import React, { createContext, useContext, useState, useEffect } from 'react';

export type Currency = 'USDC' | 'SOL';

interface CurrencyContextType {
  currency: Currency;
  setCurrency: (currency: Currency) => void;
}

const CurrencyContext = createContext<CurrencyContextType | undefined>(undefined);

export function CurrencyProvider({ children }: { children: React.ReactNode }) {
  const [currency, setCurrency] = useState<Currency>(() => {
    // Try to load from localStorage on initialization
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('preferred-currency');
      return (saved === 'USDC' || saved === 'SOL') ? saved : 'SOL';
    }
    return 'SOL';
  });

  // Save to localStorage whenever currency changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('preferred-currency', currency);
    }
  }, [currency]);

  return (
    <CurrencyContext.Provider value={{ currency, setCurrency }}>
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency() {
  const context = useContext(CurrencyContext);
  if (context === undefined) {
    throw new Error('useCurrency must be used within a CurrencyProvider');
  }
  return context;
}