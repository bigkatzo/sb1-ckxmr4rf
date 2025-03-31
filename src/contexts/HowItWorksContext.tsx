import React, { createContext, useContext, useState } from 'react';

interface HowItWorksContextType {
  isOpen: boolean;
  openHowItWorks: () => void;
  closeHowItWorks: () => void;
}

const HowItWorksContext = createContext<HowItWorksContextType>({
  isOpen: false,
  openHowItWorks: () => {},
  closeHowItWorks: () => {}
});

export function HowItWorksProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);

  const openHowItWorks = () => setIsOpen(true);
  const closeHowItWorks = () => setIsOpen(false);

  return (
    <HowItWorksContext.Provider value={{ isOpen, openHowItWorks, closeHowItWorks }}>
      {children}
    </HowItWorksContext.Provider>
  );
}

export function useHowItWorks() {
  return useContext(HowItWorksContext);
} 