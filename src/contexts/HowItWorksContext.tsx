import React, { createContext, useContext, useState } from 'react';

interface HowItWorksContextType {
  isOpen: boolean;
  open: () => void;
  close: () => void;
}

const HowItWorksContext = createContext<HowItWorksContextType>({
  isOpen: false,
  open: () => {},
  close: () => {}
});

export function HowItWorksProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);

  const open = () => setIsOpen(true);
  const close = () => setIsOpen(false);

  return (
    <HowItWorksContext.Provider value={{ isOpen, open, close }}>
      {children}
    </HowItWorksContext.Provider>
  );
}

export function useHowItWorks() {
  return useContext(HowItWorksContext);
} 