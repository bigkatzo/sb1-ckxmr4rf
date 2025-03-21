import { useOptimisticUpdate } from './useOptimisticUpdate';
import type { UserProfile } from '../types/users';

export function useUserOptimisticUpdate(initialUsers: UserProfile[] = []) {
  const {
    items: users,
    addItem,
    updateItem,
    removeItem,
    revertUpdate,
    setItems
  } = useOptimisticUpdate<UserProfile>(initialUsers);

  const updateRole = (userId: string) => {
    updateItem(userId, { role: "admin" as const });
  };

  const updateActive = (userId: string) => {
    updateItem(userId, { status: "active" });
  };

  const updateVerified = (userId: string) => {
    updateItem(userId, { verified: true });
  };

  const updateProfile = (id: string, updates: Partial<UserProfile>) => {
    updateItem(id, updates);
  };

  return {
    users,
    setUsers: setItems,
    addUser: addItem,
    updateUser: updateItem,
    removeUser: removeItem,
    revertUsers: revertUpdate,
    updateRole,
    updateActive,
    updateVerified,
    updateProfile
  };
} 