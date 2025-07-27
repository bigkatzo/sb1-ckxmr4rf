import React, { createContext, useContext, useState } from 'react';
import { TokenVerificationModal } from '../components/products/TokenVerificationModal';
import type { Product } from '../types/variants';
import { MultiItemCheckoutModal } from '../components/cart';
import { useModifiedPrice } from '../hooks/useModifiedPrice';
import { CartItemPriceInfo } from './CartContext';

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
    priceInfo: CartItemPriceInfo;
    additionalData?: {
      shippingInfo?: any;
      paymentMetadata?: any;
    };
  }>({
    isOpen: false,
    selectedOptions: {},
    priceInfo: {
      modifiedPrice: 0,
      basePrice: 0,
      variantKey: null,
      variantPriceAdjustments: 0
    }
  });

  const showVerificationModal = (
    product: Product, 
    selectedOptions: Record<string, string>,
    additionalData?: {
      shippingInfo?: any;
      paymentMetadata?: any;
    }
  ) => {
    const { modifiedPrice, originalPrice: basePrice } = useModifiedPrice({
      product,
      selectedOptions,
    });
    const priceInfo = {
      modifiedPrice,
      basePrice,
      variantKey: null,
      variantPriceAdjustments: modifiedPrice
    };
    setModalState({ isOpen: true, product, selectedOptions, additionalData, priceInfo });
  };

  const hideVerificationModal = () => {
    setModalState({ isOpen: false, selectedOptions: {}, priceInfo: { modifiedPrice: 0, basePrice: 0, variantKey: null, variantPriceAdjustments: 0 } });
  };

  return (
    <ModalContext.Provider value={{ showVerificationModal, hideVerificationModal }}>
      {children}
      {modalState.isOpen && modalState.product && (
        <MultiItemCheckoutModal
        onClose={hideVerificationModal}
        isSingle={true}
        singleItem={[{ product: modalState.product, selectedOptions: modalState.selectedOptions, quantity: 1, priceInfo: modalState.priceInfo }]} // Assuming single item checkout
        />
      )}
    </ModalContext.Provider>
  );
}

export const useModal = () => useContext(ModalContext);