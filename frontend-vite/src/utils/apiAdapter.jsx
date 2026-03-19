/**
 * API Adapter — calls the FastAPI backend.
 *
 * Auth is hardcoded (email/password POST to backend).
 * No Firebase Auth SDK required.
 */

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const rawApiBase =
  import.meta.env.VITE_API_BASE_URL !== undefined
    ? import.meta.env.VITE_API_BASE_URL
    : import.meta.env.DEV
      ? 'http://localhost:8000'
      : '';

const API_BASE = (() => {
  if (typeof window === 'undefined') return rawApiBase;

  // On HTTPS pages, block insecure/localhost API targets and use same-origin.
  if (window.location.protocol === 'https:') {
    const isLocalhost = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(rawApiBase);
    const isInsecureRemote = /^http:\/\//i.test(rawApiBase);
    if (isLocalhost || isInsecureRemote) return '';
  }

  return rawApiBase;
})();

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

// Request deduplication — prevent duplicate in-flight requests
const _pending = new Map();

/**
 * Generic fetch wrapper with auth header and request deduplication.
 * Identical GET requests in-flight are deduplicated automatically.
 */
const api = async (path, method = 'GET', body = null) => {
  const dedupeKey = method === 'GET' ? `${method}:${path}` : null;

  // Return existing promise for duplicate GET requests
  if (dedupeKey && _pending.has(dedupeKey)) {
    return _pending.get(dedupeKey);
  }

  const headers = { 'Content-Type': 'application/json' };
  if (_authToken) headers['Authorization'] = `Bearer ${_authToken}`;

  const opts = { method, headers };
  if (body) opts.body = JSON.stringify(body);

  const promise = fetch(`${API_BASE}${path}`, opts)
    .then(async (res) => {
      if (!res.ok) {
        let detail = res.statusText;
        try {
          const err = await res.json();
          detail = err.detail || detail;
        } catch { /* ignore parse errors */ }
        throw new Error(detail);
      }
      if (res.status === 204) return null;
      return res.json();
    })
    .finally(() => {
      if (dedupeKey) _pending.delete(dedupeKey);
    });

  if (dedupeKey) _pending.set(dedupeKey, promise);
  return promise;
};

// ===================================================================
// AUTH (hardcoded — no Firebase Auth SDK)
// ===================================================================

/**
 * Sign in with email + password (sent directly to backend).
 * Backend returns a signed JWT token.
 */
export const login = async (email, password) => {
  const res = await api('/api/auth/login', 'POST', { email, password });
  _authToken = res.token;
  localStorage.setItem('authToken', _authToken);
  localStorage.setItem('user', JSON.stringify(res));
  return { success: true, user: res };
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
// ENTRY DATES (log history / streak calendar)
// ===================================================================

export const getEntryDates = (startDate, endDate, supplierId = null) => {
  let url = `/api/entry-dates?startDate=${startDate}&endDate=${endDate}`;
  if (supplierId) url += `&supplierId=${supplierId}`;
  return api(url);
};

export const getEntryDateDetails = (date) =>
  api(`/api/entry-dates/${date}/details`);

// ===================================================================
// ANALYTICS
// ===================================================================

export const getAnalytics = (startDate, endDate, productType = 'chicken') =>
  api(`/api/analytics?startDate=${startDate}&endDate=${endDate}&productType=${productType}`);

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

export const setCarryover = (data) =>
  api('/api/carryover', 'PUT', data);

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

export const updatePriceRate = (data) =>
  api('/api/price-rates', 'PUT', data);

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

export const getDeductionSummary = (date) =>
  api(`/api/deduction-summary?date=${date}`);

// ===================================================================
// RMS ENTRIES
// ===================================================================

export const updateRMSEntry = (date, amount, productType = 'chicken') =>
  api('/api/rms-entries', 'PUT', { date, amount, productType });

// ===================================================================
// ATB (Amount To Be Paid) ENTRIES
// ===================================================================

export const updateATBEntry = (date, rate, productType = 'chicken') =>
  api('/api/atb-entries', 'PUT', { date, rate, productType });

// ===================================================================
// SCHOOL CUSTOM RATE
// ===================================================================

export const saveSchoolRate = (date, rate, productType = 'chicken') =>
  api('/api/school-rate', 'PUT', { date, rate, productTypeId: productType });

// ===================================================================
// CUSTOM FINANCIAL ENTRIES
// ===================================================================

export const createCustomFinancialEntry = (data) =>
  api('/api/custom-financial-entries', 'POST', data);

export const updateCustomFinancialEntry = (id, data) =>
  api(`/api/custom-financial-entries/${id}`, 'PATCH', data);

export const deleteCustomFinancialEntry = (id) =>
  api(`/api/custom-financial-entries/${id}`, 'DELETE');

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

