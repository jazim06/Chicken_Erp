import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, LayoutDashboard } from 'lucide-react';
import { SupplierCard } from '../components/SupplierCard';
import { Button } from '../components/ui/button';
import { getSuppliers } from '../utils/apiAdapter';

const SupplierListPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const productType = searchParams.get('product');
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadSuppliers = async () => {
      try {
        const data = await getSuppliers(productType);
        setSuppliers(data);
      } catch (error) {
        console.error('Failed to load suppliers:', error);
      } finally {
        setLoading(false);
      }
    };

    loadSuppliers();
  }, [productType]);

  return (
    <div className="min-h-screen bg-background py-8 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8 space-y-6 animate-fade-in">
          {/* Breadcrumb */}
          <button
            onClick={() => navigate('/product-select')}
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors duration-200 group"
          >
            <ArrowLeft className="h-4 w-4 group-hover:-translate-x-1 transition-transform duration-200" />
            Back to Products
          </button>

          {/* Title and Action */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-3xl md:text-4xl font-heading font-bold tracking-wide text-foreground mb-2">
                SELECT SUPPLIER
              </h1>
              <p className="text-muted-foreground">
                Choose a supplier to manage entries
              </p>
            </div>
            <Button
              onClick={() => navigate(`/supplier/${suppliers[0]?.id}/dashboard`)}
              className="bg-primary hover:bg-primary-hover gap-2"
              disabled={suppliers.length === 0}
            >
              <LayoutDashboard className="h-4 w-4" />
              View Dashboard
            </Button>
          </div>
        </div>

        {/* Supplier Grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-32 bg-card rounded-lg animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-slide-up">
            {suppliers.map((supplier) => (
              <SupplierCard key={supplier.id} supplier={supplier} />
            ))}
            <SupplierCard isAddNew />
          </div>
        )}
      </div>
    </div>
  );
};

export default SupplierListPage;
