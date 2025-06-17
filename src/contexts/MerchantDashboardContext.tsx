import React, { createContext, useState, useContext, useEffect } from 'react';

interface MerchantDashboardContextType {
  selectedCollection: string;
  selectedCategory: string;
  setSelectedCollection: (id: string) => void;
  setSelectedCategory: (id: string) => void;
  clearCollectionSelection: () => void;
  clearCategorySelection: () => void;
  clearAllSelections: () => void;
}

const defaultContext: MerchantDashboardContextType = {
  selectedCollection: '',
  selectedCategory: '',
  setSelectedCollection: () => {},
  setSelectedCategory: () => {},
  clearCollectionSelection: () => {},
  clearCategorySelection: () => {},
  clearAllSelections: () => {}
};

const MerchantDashboardContext = createContext<MerchantDashboardContextType>(defaultContext);

export function MerchantDashboardProvider({ children }: { children: React.ReactNode }) {
  // Read initial values from localStorage for persistence across page refreshes
  const [selectedCollection, setSelectedCollectionState] = useState<string>(() => {
    const saved = localStorage.getItem('merchant_dashboard_selected_collection');
    return saved || '';
  });
  
  const [selectedCategory, setSelectedCategoryState] = useState<string>(() => {
    const saved = localStorage.getItem('merchant_dashboard_selected_category');
    return saved || '';
  });
  
  // Save collection to localStorage whenever selection changes
  useEffect(() => {
    if (selectedCollection) {
      localStorage.setItem('merchant_dashboard_selected_collection', selectedCollection);
    } else {
      localStorage.removeItem('merchant_dashboard_selected_collection');
    }
  }, [selectedCollection]);
  
  // Save category to localStorage whenever selection changes
  useEffect(() => {
    if (selectedCategory) {
      localStorage.setItem('merchant_dashboard_selected_category', selectedCategory);
    } else {
      localStorage.removeItem('merchant_dashboard_selected_category');
    }
  }, [selectedCategory]);
  
  // When collection changes, clear the category selection
  useEffect(() => {
    setSelectedCategoryState('');
  }, [selectedCollection]);
  
  const setSelectedCollection = (id: string) => {
    setSelectedCollectionState(id);
  };
  
  const setSelectedCategory = (id: string) => {
    setSelectedCategoryState(id);
  };
  
  const clearCollectionSelection = () => {
    setSelectedCollectionState('');
  };
  
  const clearCategorySelection = () => {
    setSelectedCategoryState('');
  };
  
  const clearAllSelections = () => {
    setSelectedCollectionState('');
    setSelectedCategoryState('');
  };
  
  return (
    <MerchantDashboardContext.Provider 
      value={{ 
        selectedCollection, 
        selectedCategory,
        setSelectedCollection,
        setSelectedCategory,
        clearCollectionSelection,
        clearCategorySelection,
        clearAllSelections
      }}
    >
      {children}
    </MerchantDashboardContext.Provider>
  );
}

export const useMerchantDashboard = () => useContext(MerchantDashboardContext); 