import React, { createContext, useContext, useState } from 'react';
import { TokenVerificationModal } from '../components/products/TokenVerificationModal';
import type { Product } from '../types/variants';
import { MultiItemCheckoutModal } from '../components/cart';

interface ModalContextType {
  showVerificationModal: (
    product: Product, 
    selectedOptions: Record<string, string>,
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
    selectedOptions: Record<string, string>;
    additionalData?: {
      shippingInfo?: any;
      paymentMetadata?: any;
    };
  }>({
    isOpen: false,
    selectedOptions: {},
  });

  const showVerificationModal = (
    product: Product, 
    selectedOptions: Record<string, string>,
    additionalData?: {
      shippingInfo?: any;
      paymentMetadata?: any;
    }
  ) => {
    console.log('showVerificationModal', product, selectedOptions, additionalData);
    setModalState({ isOpen: true, product, selectedOptions, additionalData });
  };

  const hideVerificationModal = () => {
    setModalState({ isOpen: false, selectedOptions: {} });
  };

  return (
    <ModalContext.Provider value={{ showVerificationModal, hideVerificationModal }}>
      {children}
      {modalState.isOpen && modalState.product && (
        <MultiItemCheckoutModal
        onClose={hideVerificationModal}
        isSingle={true}
        singleItem={[{ product: modalState.product, selectedOptions: modalState.selectedOptions, quantity: 1, priceInfo: {
          modifiedPrice: 0, // Placeholder, will be calculated in the modal
          basePrice: 0,
          variantKey: null,
          variantPriceAdjustments: 0
        } }]} // Assuming single item checkout
        />
      )}
    </ModalContext.Provider>
  );
}

export const useModal = () => useContext(ModalContext);