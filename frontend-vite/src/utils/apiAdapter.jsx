/**
 * API Adapter — calls the FastAPI backend.
 *
 * Auth is hardcoded (email/password POST to backend).
 * No Firebase Auth SDK required.
 */

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

// Dev token stored after login
let _authToken = localStorage.getItem('authToken') || null;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Format currency in Indian Rupees */
export const formatCurrency = (amount) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);

/** Format weight to 3 decimal places */
export const formatWeight = (weight) =>
  typeof weight === 'number' ? weight.toFixed(3) : '0.000';

/**
 * Generic fetch wrapper with auth header.
 * Throws on non-2xx responses with the server's detail message.
 */
const api = async (path, method = 'GET', body = null) => {
  const headers = { 'Content-Type': 'application/json' };
  if (_authToken) headers['Authorization'] = `Bearer ${_authToken}`;

  const opts = { method, headers };
  if (body) opts.body = JSON.stringify(body);

  const res = await fetch(`${API_BASE}${path}`, opts);

  if (!res.ok) {
    let detail = res.statusText;
    try {
      const err = await res.json();
      detail = err.detail || detail;
    } catch { /* ignore parse errors */ }
    throw new Error(detail);
  }

  // 204 No Content
  if (res.status === 204) return null;
  return res.json();
};

// ===================================================================
// AUTH (hardcoded — no Firebase Auth SDK)
// ===================================================================

/**
 * Sign in with email + password (sent directly to backend).
 * Backend checks against hardcoded credentials.
 */
export const login = async (email, password) => {
  const user = await api('/api/auth/login', 'POST', { email, password });
  _authToken = 'dev-hardcoded-token';
  localStorage.setItem('authToken', _authToken);
  localStorage.setItem('user', JSON.stringify(user));
  return { success: true, user };
};

export const logout = () => {
  _authToken = null;
  localStorage.removeItem('authToken');
  localStorage.removeItem('user');
};

export const getCurrentUser = () => {
  const stored = localStorage.getItem('user');
  return stored ? JSON.parse(stored) : null;
};

/** No-op — auth state changes are not relevant without Firebase Auth */
export const onAuthChange = (_callback) => () => {};

// ===================================================================
// PRODUCTS
// ===================================================================

export const getProducts = () => api('/api/products');

// ===================================================================
// SUPPLIERS
// ===================================================================

export const getSuppliers = (productType = null) => {
  const qs = productType ? `?productType=${encodeURIComponent(productType)}` : '';
  return api(`/api/suppliers${qs}`);
};

export const getSupplierById = (id) => api(`/api/suppliers/${id}`);

export const createSupplier = (data) =>
  api('/api/suppliers', 'POST', data);

// ===================================================================
// SUB-PARTIES
// ===================================================================

export const addSubParty = (supplierId, partyName) =>
  api(`/api/suppliers/${supplierId}/sub-parties`, 'POST', { partyName });

export const deleteSubParty = (supplierId, subPartyId) =>
  api(`/api/suppliers/${supplierId}/sub-parties/${subPartyId}`, 'DELETE');

// ===================================================================
// WEIGHT ENTRIES
// ===================================================================

export const getEntriesByDate = (supplierId, date) =>
  api(`/api/weight-entries?date=${date}&supplierId=${supplierId}`);

export const saveEntry = (data) =>
  api('/api/weight-entries', 'POST', data);

export const updateWeightEntry = (id, data) =>
  api(`/api/weight-entries/${id}`, 'PATCH', data);

export const deleteWeightEntry = (id) =>
  api(`/api/weight-entries/${id}`, 'DELETE');

// ===================================================================
// DASHBOARD
// ===================================================================

export const getDashboardData = async (_supplierId, date) => {
  // If no date provided, use today
  const d = date || new Date().toISOString().slice(0, 10);
  return api(`/api/dashboard?date=${d}`);
};

export const confirmDashboard = (date, productType = 'chicken') =>
  api(`/api/dashboard/confirm?date=${date}&productType=${productType}`, 'POST');

// ===================================================================
// FINANCIAL ENTRIES
// ===================================================================

export const getFinancialEntries = (date, section = 'MAIN') =>
  api(`/api/financial-entries?date=${date}&section=${section}`);

export const createFinancialEntry = (data) =>
  api('/api/financial-entries', 'POST', data);

export const updateFinancialEntry = (id, data) =>
  api(`/api/financial-entries/${id}`, 'PATCH', data);

export const deleteFinancialEntry = (id) =>
  api(`/api/financial-entries/${id}`, 'DELETE');

export const reorderFinancialEntries = (items) =>
  api('/api/financial-entries/reorder', 'PATCH', { items });

// ===================================================================
// SECTION F ENTRIES
// ===================================================================

export const getSectionFEntries = (date) =>
  api(`/api/section-f-entries?date=${date}`);

export const createSectionFEntry = (data) =>
  api('/api/section-f-entries', 'POST', data);

export const updateSectionFEntry = (id, data) =>
  api(`/api/section-f-entries/${id}`, 'PATCH', data);

export const deleteSectionFEntry = (id) =>
  api(`/api/section-f-entries/${id}`, 'DELETE');

// ===================================================================
// PRICE RATES
// ===================================================================

export const getPriceRate = (date, productTypeId = 'chicken') =>
  api(`/api/price-rates?date=${date}&productTypeId=${productTypeId}`);

export const createPriceRate = (data) =>
  api('/api/price-rates', 'POST', data);

// ===================================================================
// DASHBOARD INLINE-EDIT HELPERS
// (Match the signatures the SupplierDashboardPage already uses)
// ===================================================================

/**
 * updateDashboardEntry(type, id, field, value)
 *
 * Maps the generic inline-edit calls from the dashboard UI to the
 * correct backend endpoints.
 */
export const updateDashboardEntry = async (type, id, field, value, date = null) => {
  const today = date || new Date().toISOString().slice(0, 10);

  if (type === 'totals' || type === 'financial') {
    // Update financial entry
    const payload = {};
    if (field === 'total' || field === 'weight') payload.weight = parseFloat(value);
    else if (field === 'amount') payload.amount = parseFloat(value);
    else payload[field] = value;
    await updateFinancialEntry(id, payload);
  } else if (type === 'other') {
    // Update section F entry
    await updateSectionFEntry(id, { amount: parseFloat(value) });
  } else if (type === 'supplier') {
    // Supplier weight entries — field is {rowId, column}
    // This maps to updating the weight entry directly
    const payload = {};
    if (field.column === 'a') payload.loadWeight = parseFloat(value);
    // For b and c columns, they are computed — skip or handle as needed
    if (Object.keys(payload).length) {
      await updateWeightEntry(field.rowId, payload);
    }
  }

  // Re-fetch full dashboard to return updated state
  return getDashboardData(null, today);
};

/**
 * createDashboardEntry(type, data)
 */
export const createDashboardEntry = async (type, data, date = null) => {
  const today = date || new Date().toISOString().slice(0, 10);

  if (type === 'totals' || type === 'financial') {
    await createFinancialEntry({
      customerName: data.name || data.party,
      weight: parseFloat(data.value || data.weight || 0),
      date: today,
      calculationMethod: 'STANDARD',
      section: type === 'totals' ? 'MAIN' : 'MAIN',
      ...(data.formula ? { formula: data.formula } : {}),
      ...(data.amount ? { ratePerKg: undefined } : {}),
    });
  } else if (type === 'other') {
    await createSectionFEntry({
      name: data.name,
      amount: parseFloat(data.value || 0),
      date: today,
    });
  }

  return getDashboardData(null, today);
};

/**
 * deleteDashboardEntry(type, id)
 */
export const deleteDashboardEntry = async (type, id) => {
  const today = new Date().toISOString().slice(0, 10);

  if (type === 'totals' || type === 'financial') {
    await deleteFinancialEntry(id);
  } else if (type === 'other') {
    await deleteSectionFEntry(id);
  }

  return getDashboardData(null, today);
};

// ===================================================================
// DEDUCTION ENTRIES
// ===================================================================

export const getDeductionEntries = (date) =>
  api(`/api/deduction-entries?date=${date}`);

export const createDeductionEntry = (data) =>
  api('/api/deduction-entries', 'POST', data);

export const updateDeductionEntry = (id, data) =>
  api(`/api/deduction-entries/${id}`, 'PATCH', data);

export const deleteDeductionEntry = (id) =>
  api(`/api/deduction-entries/${id}`, 'DELETE');

// ===================================================================
// REAL-TIME LISTENERS (Firestore)
// ===================================================================

/**
 * Subscribe to real-time changes on financial_entries for a given date.
 * Returns an unsubscribe function.
 */
export const subscribeFinancialEntries = (date, callback) => {
  const q = query(
    collection(db, 'financial_entries'),
    where('date', '==', date),
    orderBy('sortOrder'),
  );
  return onSnapshot(q, (snap) => {
    const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    callback(docs);
  });
};

/**
 * Subscribe to real-time changes on section_f_entries for a given date.
 */
export const subscribeSectionFEntries = (date, callback) => {
  const q = query(
    collection(db, 'section_f_entries'),
    where('date', '==', date),
    orderBy('sortOrder'),
  );
  return onSnapshot(q, (snap) => {
    const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    callback(docs);
  });
};

/**
 * Subscribe to real-time changes on weight_entries for a given date.
 */
export const subscribeWeightEntries = (date, callback) => {
  const q = query(
    collection(db, 'weight_entries'),
    where('date', '==', date),
    where('isDeleted', '==', false),
  );
  return onSnapshot(q, (snap) => {
    const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    callback(docs);
  });
};

