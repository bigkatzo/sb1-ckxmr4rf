import React, { createContext, useContext, useState } from 'react';
import { TokenVerificationModal } from '../components/products/TokenVerificationModal';
import type { Product } from '../types/variants';

interface ModalContextType {
  showVerificationModal: (
    product: Product, 
    selectedOptions?: Record<string, string>,
    additionalData?: {
      shippingInfo?: any;
      paymentMetadata?: any;
    }
  ) => void;
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
    additionalData?: {
      shippingInfo?: any;
      paymentMetadata?: any;
    };
  }>({
    isOpen: false
  });

  const showVerificationModal = (
    product: Product, 
    selectedOptions?: Record<string, string>,
    additionalData?: {
      shippingInfo?: any;
      paymentMetadata?: any;
    }
  ) => {
    setModalState({ isOpen: true, product, selectedOptions, additionalData });
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
          selectedOption={modalState.selectedOptions}
          onClose={hideVerificationModal}
          onSuccess={() => {
            hideVerificationModal();
          }}
          shippingInfo={modalState.additionalData?.shippingInfo}
          paymentMetadata={modalState.additionalData?.paymentMetadata}
        />
      )}
    </ModalContext.Provider>
  );
}

export const useModal = () => useContext(ModalContext);