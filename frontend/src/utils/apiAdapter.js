// API Adapter - Stub functions for backend integration
import { users, products, suppliers, entries, dashboardData } from '../data/seedData';

// In-memory state management (for prototype)
let currentUser = null;
let entriesData = [...entries];

// Helper to format currency
export const formatCurrency = (amount) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount);
};

// Helper to format weight
export const formatWeight = (weight) => {
  return weight.toFixed(3);
};

// Auth APIs
export const login = async (email, password) => {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      const user = users.find(u => u.email === email && u.password === password);
      if (user) {
        currentUser = user;
        localStorage.setItem('user', JSON.stringify(user));
        resolve({ success: true, user });
      } else {
        reject({ success: false, message: 'Invalid credentials' });
      }
    }, 500);
  });
};

export const logout = () => {
  currentUser = null;
  localStorage.removeItem('user');
};

export const getCurrentUser = () => {
  const stored = localStorage.getItem('user');
  return stored ? JSON.parse(stored) : null;
};

// Product APIs
export const getProducts = async () => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(products);
    }, 300);
  });
};

// Supplier APIs
export const getSuppliers = async (productType = null) => {
  return new Promise((resolve) => {
    setTimeout(() => {
      const filtered = productType
        ? suppliers.filter(s => s.productType === productType)
        : suppliers;
      resolve(filtered);
    }, 300);
  });
};

export const getSupplierById = async (id) => {
  return new Promise((resolve) => {
    setTimeout(() => {
      const supplier = suppliers.find(s => s.id === parseInt(id));
      resolve(supplier);
    }, 300);
  });
};

export const createSupplier = async (supplierData) => {
  return new Promise((resolve) => {
    setTimeout(() => {
      const newSupplier = {
        id: suppliers.length + 1,
        ...supplierData,
        active: true,
        subParties: []
      };
      suppliers.push(newSupplier);
      resolve(newSupplier);
    }, 500);
  });
};

// Entry APIs
export const getEntriesByDate = async (supplierId, date) => {
  return new Promise((resolve) => {
    setTimeout(() => {
      const filtered = entriesData.filter(
        e => e.supplierId === parseInt(supplierId) && e.date === date
      );
      resolve(filtered);
    }, 300);
  });
};

export const saveEntry = async (entryData) => {
  return new Promise((resolve) => {
    setTimeout(() => {
      const newEntry = {
        id: entriesData.length + 1,
        ...entryData,
        createdAt: new Date().toISOString()
      };
      entriesData.push(newEntry);
      
      // Update sub-party weight
      const supplier = suppliers.find(s => s.id === entryData.supplierId);
      if (supplier) {
        const subParty = supplier.subParties.find(sp => sp.id === entryData.subPartyId);
        if (subParty) {
          subParty.todayWeight += entryData.liveWeight;
          subParty.totalWeight += entryData.liveWeight;
        }
      }
      
      resolve(newEntry);
    }, 500);
  });
};

// Dashboard APIs
export const getDashboardData = async (supplierId) => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(dashboardData);
    }, 500);
  });
};
