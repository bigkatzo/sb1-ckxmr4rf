import React, { createContext, useContext, useState } from 'react';
import { TokenVerificationModal } from '../components/products/TokenVerificationModal';
import type { Product } from '../types';

interface ModalContextType {
  showVerificationModal: (product: Product, selectedOptions?: Record<string, string>) => void;
  hideVerificationModal: () => void;
}

const ModalContext = createContext<ModalContextType>({
  showVerificationModal: () => {},
  hideVerificationModal: () => {}
});

export function ModalProvider({ children }: { children: React.ReactNode }) {
  const [modalState, setModalState] = useState<{
    isOpen: boolean;
    product?: Product;
    selectedOptions?: Record<string, string>;
  }>({
    isOpen: false
  });

  const showVerificationModal = (product: Product, selectedOptions?: Record<string, string>) => {
    setModalState({ isOpen: true, product, selectedOptions });
  };

  const hideVerificationModal = () => {
    setModalState({ isOpen: false });
  };

  return (
    <ModalContext.Provider value={{ showVerificationModal, hideVerificationModal }}>
      {children}
      {modalState.isOpen && modalState.product && (
        <TokenVerificationModal
          product={modalState.product}
          selectedOptions={modalState.selectedOptions}
          onClose={hideVerificationModal}
          onSuccess={() => {
            hideVerificationModal();
          }}
        />
      )}
    </ModalContext.Provider>
  );
}

export const useModal = () => useContext(ModalContext);