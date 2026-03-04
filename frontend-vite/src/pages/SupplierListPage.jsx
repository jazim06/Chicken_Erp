import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, LayoutDashboard } from 'lucide-react';
import { SupplierCard } from '../components/SupplierCard';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import { getSuppliers, createSupplier } from '../utils/apiAdapter';
import { toast } from 'sonner';

const SupplierListPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const productType = searchParams.get('product');
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [newSupplierName, setNewSupplierName] = useState('');
  const [saving, setSaving] = useState(false);

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

  useEffect(() => {
    loadSuppliers();
  }, [productType]);

  const handleAddSupplier = async () => {
    const name = newSupplierName.trim();
    if (!name) {
      toast.error('Please enter a supplier name');
      return;
    }
    setSaving(true);
    try {
      await createSupplier({ name: name.toUpperCase(), productType: productType || 'chicken' });
      toast.success(`Supplier "${name.toUpperCase()}" created`);
      setAddModalOpen(false);
      setNewSupplierName('');
      await loadSuppliers();
    } catch (error) {
      console.error('Failed to create supplier:', error);
      toast.error('Failed to create supplier');
    } finally {
      setSaving(false);
    }
  };

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
            <SupplierCard isAddNew onAddNew={() => setAddModalOpen(true)} />
          </div>
        )}
      </div>

      {/* Add Supplier Modal */}
      <Dialog open={addModalOpen} onOpenChange={setAddModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold">Add New Supplier</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Supplier Name</Label>
              <Input
                value={newSupplierName}
                onChange={(e) => setNewSupplierName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddSupplier()}
                placeholder="Enter supplier name"
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">Product Type</Label>
              <Input
                value={(productType || 'chicken').toUpperCase()}
                disabled
                className="bg-muted"
              />
            </div>
            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                onClick={() => { setAddModalOpen(false); setNewSupplierName(''); }}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={handleAddSupplier}
                className="flex-1 bg-primary hover:bg-primary-hover"
                disabled={!newSupplierName.trim() || saving}
              >
                {saving ? 'Creating...' : 'Create Supplier'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SupplierListPage;
