// API Adapter - Stub functions for backend integration
import { users, products, suppliers, entries, dashboardData } from '../data/seedData';

// In-memory state management (for prototype)
let currentUser = null;
let entriesData = [...entries];
let dashboardState = JSON.parse(JSON.stringify(dashboardData));

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

// Sub-Party APIs
export const addSubParty = async (supplierId, partyName) => {
  return new Promise((resolve) => {
    setTimeout(() => {
      const supplier = suppliers.find(s => s.id === parseInt(supplierId));
      if (supplier) {
        const newSubParty = {
          id: Date.now(),
          name: partyName,
          todayWeight: 0,
          totalWeight: 0
        };
        supplier.subParties.push(newSubParty);
        resolve(newSubParty);
      }
    }, 300);
  });
};

export const deleteSubParty = async (supplierId, subPartyId) => {
  return new Promise((resolve) => {
    setTimeout(() => {
      const supplier = suppliers.find(s => s.id === parseInt(supplierId));
      if (supplier) {
        supplier.subParties = supplier.subParties.filter(sp => sp.id !== subPartyId);
        resolve({ success: true });
      }
    }, 300);
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
      resolve(JSON.parse(JSON.stringify(dashboardState)));
    }, 500);
  });
};

export const updateDashboardEntry = async (type, id, field, value) => {
  return new Promise((resolve) => {
    setTimeout(() => {
      if (type === 'supplier') {
        const supplier = dashboardState.suppliers.find(s => s.id === id);
        if (supplier) {
          const row = supplier.rows.find(r => r.id === field.rowId);
          if (row) {
            row[field.column] = parseFloat(value);
          }
        }
      } else if (type === 'other') {
        const item = dashboardState.otherCalculations.items.find(i => i.id === id);
        if (item) {
          item.value = parseFloat(value);
        }
      } else if (type === 'totals') {
        const total = dashboardState.totalsOverview.find(t => t.id === id);
        if (total) {
          total.total = parseFloat(value);
        }
      } else if (type === 'financial') {
        const fin = dashboardState.financial.find(f => f.id === id);
        if (fin) {
          fin.amount = parseFloat(value);
        }
      }
      resolve(dashboardState);
    }, 300);
  });
};

export const createDashboardEntry = async (type, data) => {
  return new Promise((resolve) => {
    setTimeout(() => {
      const newId = `new_${Date.now()}`;
      
      if (type === 'supplier') {
        const supplier = dashboardState.suppliers.find(s => s.id === data.supplierId);
        if (supplier) {
          const newRow = {
            id: newId,
            party: data.party,
            a: parseFloat(data.a) || 0,
            b: parseFloat(data.b) || 0,
            c: parseFloat(data.c) || 0
          };
          supplier.rows.push(newRow);
        }
      } else if (type === 'other') {
        dashboardState.otherCalculations.items.push({
          id: newId,
          name: data.name,
          value: parseFloat(data.value) || 0
        });
      } else if (type === 'totals') {
        dashboardState.totalsOverview.push({
          id: newId,
          party: data.party,
          total: parseFloat(data.total) || 0,
          highlight: false
        });
      } else if (type === 'financial') {
        dashboardState.financial.push({
          id: newId,
          name: data.name,
          amount: parseFloat(data.amount) || 0,
          highlight: false
        });
      }
      
      resolve(dashboardState);
    }, 300);
  });
};

export const deleteDashboardEntry = async (type, id) => {
  return new Promise((resolve) => {
    setTimeout(() => {
      if (type === 'supplier') {
        dashboardState.suppliers.forEach(supplier => {
          supplier.rows = supplier.rows.filter(r => r.id !== id);
        });
      } else if (type === 'other') {
        dashboardState.otherCalculations.items = 
          dashboardState.otherCalculations.items.filter(i => i.id !== id);
      } else if (type === 'totals') {
        dashboardState.totalsOverview = 
          dashboardState.totalsOverview.filter(t => t.id !== id);
      } else if (type === 'financial') {
        dashboardState.financial = 
          dashboardState.financial.filter(f => f.id !== id);
      }
      resolve(dashboardState);
    }, 300);
  });
};
