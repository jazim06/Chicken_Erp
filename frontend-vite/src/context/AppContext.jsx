import React, { createContext, useContext, useState, useCallback } from 'react';

const AppContext = createContext(null);

const STORAGE_KEY = 'chickenErp_lastSupplier';

function readStored() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function AppProvider({ children }) {
  const stored = readStored();

  const [lastSupplierId, setLastSupplierId] = useState(stored?.id || null);
  const [lastSupplierName, setLastSupplierName] = useState(stored?.name || null);
  const [lastProductType, setLastProductType] = useState(stored?.productType || null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const setLastSupplier = useCallback((id, name, productType) => {
    setLastSupplierId(id);
    setLastSupplierName(name);
    setLastProductType(productType);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ id, name, productType }));
    } catch { /* ignore */ }
  }, []);

  return (
    <AppContext.Provider
      value={{
        lastSupplierId,
        lastSupplierName,
        lastProductType,
        setLastSupplier,
        sidebarOpen,
        setSidebarOpen,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useAppContext() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useAppContext must be used within AppProvider');
  return ctx;
}
