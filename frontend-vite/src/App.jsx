import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from './components/ui/sonner';
import LoginPage from './pages/LoginPage';
import ProductSelectPage from './pages/ProductSelectPage';
import SupplierListPage from './pages/SupplierListPage';
import SupplierManagementPage from './pages/SupplierManagementPage';
import SupplierDashboardPage from './pages/SupplierDashboardPage';
import { getCurrentUser } from './utils/apiAdapter';

// Protected Route Component
const ProtectedRoute = ({ children }) => {
  const user = getCurrentUser();
  return user ? children : <Navigate to="/login" replace />;
};

function App() {
  return (
    <Router>
      <div className="App min-h-screen">
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/product-select"
            element={
              <ProtectedRoute>
                <ProductSelectPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/suppliers"
            element={
              <ProtectedRoute>
                <SupplierListPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/supplier/:id"
            element={
              <ProtectedRoute>
                <SupplierManagementPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/supplier/:id/dashboard"
            element={
              <ProtectedRoute>
                <SupplierDashboardPage />
              </ProtectedRoute>
            }
          />
          <Route path="/" element={<Navigate to="/login" replace />} />
        </Routes>
        <Toaster position="top-right" richColors />
      </div>
    </Router>
  );
}

export default App;
