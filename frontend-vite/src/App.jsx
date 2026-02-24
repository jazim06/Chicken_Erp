import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from './components/ui/sonner';
import LoginPage from './pages/LoginPage';
import ProductSelectPage from './pages/ProductSelectPage';
import SupplierListPage from './pages/SupplierListPage';
import SupplierManagementPage from './pages/SupplierManagementPage';
import SupplierDashboardPage from './pages/SupplierDashboardPage';
import LogHistoryPage from './pages/LogHistoryPage';
import AnalyticsPage from './pages/AnalyticsPage';
import AppLayout from './components/AppLayout';
import { AppProvider } from './context/AppContext';
import { getCurrentUser } from './utils/apiAdapter';

// Protected Route Component
const ProtectedRoute = ({ children }) => {
  const user = getCurrentUser();
  return user ? children : <Navigate to="/login" replace />;
};

function App() {
  return (
    <Router>
      <AppProvider>
        <div className="App min-h-screen">
          <Routes>
            <Route path="/login" element={<LoginPage />} />

            {/* All protected routes share the AppLayout (sidebar + content) */}
            <Route
              element={
                <ProtectedRoute>
                  <AppLayout />
                </ProtectedRoute>
              }
            >
              <Route path="/product-select" element={<ProductSelectPage />} />
              <Route path="/suppliers" element={<SupplierListPage />} />
              <Route path="/supplier/:id" element={<SupplierManagementPage />} />
              <Route path="/supplier/:id/dashboard" element={<SupplierDashboardPage />} />
              <Route path="/history" element={<LogHistoryPage />} />
              <Route path="/analytics" element={<AnalyticsPage />} />
            </Route>

            <Route path="/" element={<Navigate to="/login" replace />} />
          </Routes>
          <Toaster position="top-right" richColors />
        </div>
      </AppProvider>
    </Router>
  );
}

export default App;
