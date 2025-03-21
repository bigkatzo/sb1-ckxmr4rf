import { useOptimisticUpdate } from './useOptimisticUpdate';
import type { Wallet } from '../types/wallets';

export function useWalletOptimisticUpdate(initialWallets: Wallet[] = []) {
  const {
    items: wallets,
    addItem,
    updateItem,
    removeItem,
    revertUpdate,
    setItems
  } = useOptimisticUpdate<Wallet>(initialWallets);

  const updateBalance = (walletId: string) => {
    updateItem(walletId, { balance: "0" });
  };

  const updateActive = (walletId: string) => {
    updateItem(walletId, { active: true });
  };

  const updateVerified = (walletId: string) => {
    updateItem(walletId, { verified: true });
  };

  const updateLabel = (id: string, label: string) => {
    updateItem(id, { label });
  };

  return {
    wallets,
    setWallets: setItems,
    addWallet: addItem,
    updateWallet: updateItem,
    removeWallet: removeItem,
    revertWallets: revertUpdate,
    updateBalance,
    updateActive,
    updateVerified,
    updateLabel
  };
} 