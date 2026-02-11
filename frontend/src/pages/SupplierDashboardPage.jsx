import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Plus, Save, Download } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { InlineEdit } from '../components/InlineEdit';
import { AddEntryModal } from '../components/AddEntryModal';
import {
  getDashboardData,
  updateDashboardEntry,
  createDashboardEntry,
  formatCurrency,
  formatWeight
} from '../utils/apiAdapter';
import { toast } from 'sonner';
import { cn } from '../lib/utils';

const SupplierDashboardPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [addModalOpen, setAddModalOpen] = useState(false);

  useEffect(() => {
    loadDashboard();
  }, [id]);

  const loadDashboard = async () => {
    try {
      const data = await getDashboardData(id);
      setDashboardData(data);
    } catch (error) {
      console.error('Failed to load dashboard:', error);
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateEntry = async (type, id, field, value) => {
    try {
      const updated = await updateDashboardEntry(type, id, field, value);
      setDashboardData(updated);
      toast.success('Updated successfully');
    } catch (error) {
      toast.error('Failed to update');
    }
  };

  const handleAddEntry = async (formData) => {
    try {
      const updated = await createDashboardEntry(formData.type, formData);
      setDashboardData(updated);
      setAddModalOpen(false);
      toast.success('Entry added successfully');
    } catch (error) {
      toast.error('Failed to add entry');
    }
  };

  const handleSave = () => {
    toast.success('Dashboard data saved successfully!');
  };

  const handleExport = () => {
    toast.success('Exporting dashboard data...');
  };

  // Calculate totals
  const calculateSupplierTotal = (rows) => {
    return rows.reduce((sum, row) => sum + (row.c || 0), 0);
  };

  const calculateOtherTotal = () => {
    if (!dashboardData?.otherCalculations?.items) return 0;
    return dashboardData.otherCalculations.items.reduce((sum, item) => sum + (item.value || 0), 0);
  };

  const calculateSubtotal = () => {
    if (!dashboardData?.totalsOverview) return 0;
    return dashboardData.totalsOverview.reduce((sum, item) => sum + (item.total || 0), 0);
  };

  const calculateGrandTotal = () => {
    if (!dashboardData?.financial) return 0;
    return dashboardData.financial.reduce((sum, item) => sum + (item.amount || 0), 0);
  };

  const calculateTotalBalance = () => {
    const subtotal = calculateSubtotal();
    return subtotal;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background py-8 px-4">
      <div className="max-w-[1280px] mx-auto space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 animate-fade-in">
          <div className="space-y-2">
            <button
              onClick={() => navigate(`/supplier/${id}`)}
              className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors duration-200 group"
            >
              <ArrowLeft className="h-4 w-4 group-hover:-translate-x-1 transition-transform duration-200" />
              Supplier Dashboard
            </button>
            <h1 className="text-3xl md:text-4xl font-heading font-bold tracking-wide text-foreground">
              SUPPLIER DASHBOARD
            </h1>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button
              onClick={() => setAddModalOpen(true)}
              className="gap-2 bg-primary hover:bg-primary-hover"
            >
              <Plus className="h-4 w-4" />
              Add New
            </Button>
            <Button onClick={handleSave} variant="outline" className="gap-2">
              <Save className="h-4 w-4" />
              Save
            </Button>
            <Button onClick={handleExport} variant="outline" className="gap-2">
              <Download className="h-4 w-4" />
              Export
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 animate-slide-up">
          <div className="space-y-6">
            {dashboardData?.suppliers?.map((supplier) => (
              <Card key={supplier.id} className="p-5">
                <h2 className="text-sm font-heading font-bold uppercase tracking-wider mb-4 text-foreground">
                  {supplier.name}
                </h2>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left py-2 px-2 font-semibold text-muted-foreground">Item</th>
                        <th className="text-right py-2 px-2 font-semibold text-muted-foreground">A</th>
                        <th className="text-right py-2 px-2 font-semibold text-muted-foreground">B</th>
                        <th className="text-right py-2 px-2 font-semibold text-muted-foreground">C</th>
                      </tr>
                    </thead>
                    <tbody>
                      {supplier.rows.map((row) => (
                        <tr key={row.id} className="border-b border-border/50">
                          <td className="py-2 px-2 font-medium">{row.party}</td>
                          <td className="text-right py-2 px-2">
                            <InlineEdit
                              value={row.a}
                              onSave={(val) => handleUpdateEntry('supplier', supplier.id, { rowId: row.id, column: 'a' }, val)}
                              className="justify-end"
                            />
                          </td>
                          <td className="text-right py-2 px-2">
                            <InlineEdit
                              value={row.b}
                              onSave={(val) => handleUpdateEntry('supplier', supplier.id, { rowId: row.id, column: 'b' }, val)}
                              className="justify-end"
                            />
                          </td>
                          <td className="text-right py-2 px-2">
                            <InlineEdit
                              value={row.c}
                              onSave={(val) => handleUpdateEntry('supplier', supplier.id, { rowId: row.id, column: 'c' }, val)}
                              className="justify-end"
                            />
                          </td>
                        </tr>
                      ))}
                      <tr className="bg-muted/50 font-bold">
                        <td className="py-2 px-2">Total</td>
                        <td colSpan="3" className="text-right py-2 px-2 weight-display">
                          {formatWeight(calculateSupplierTotal(supplier.rows))}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </Card>
            ))}

            <Card className="p-5">
              <h2 className="text-sm font-heading font-bold uppercase tracking-wider mb-4 text-foreground">
                Other Calculations
              </h2>
              <div className="space-y-1">
                <div className="text-xs font-semibold text-primary mb-2">
                  {dashboardData?.otherCalculations?.title}
                </div>
                {dashboardData?.otherCalculations?.items?.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between py-2 border-b border-border/50 text-sm"
                  >
                    <span className="font-medium">{item.name}</span>
                    <InlineEdit
                      value={item.value}
                      onSave={(val) => handleUpdateEntry('other', item.id, 'value', val)}
                      className="justify-end"
                    />
                  </div>
                ))}
                <div className="flex items-center justify-between py-2 bg-muted/50 font-bold text-sm rounded mt-2">
                  <span className="px-2">Total</span>
                  <span className="weight-display px-2">{formatWeight(calculateOtherTotal())}</span>
                </div>
              </div>
            </Card>

            <Card className="p-6 stat-bar-gradient">
              <div className="text-center space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-background/90">
                  Total Balance
                </p>
                <p className="text-4xl font-heading font-bold text-background weight-display">
                  {formatWeight(calculateTotalBalance())} kg
                </p>
              </div>
            </Card>
          </div>

          <div>
            <Card className="p-5">
              <h2 className="text-sm font-heading font-bold uppercase tracking-wider mb-4 text-foreground">
                Totals Overview
              </h2>
              <div className="space-y-1">
                {dashboardData?.totalsOverview?.map((item) => (
                  <div
                    key={item.id}
                    className={cn(
                      "flex items-center justify-between py-2 border-b border-border/50 text-sm",
                      item.highlight && "bg-blue-50/50"
                    )}
                  >
                    <span className="font-medium px-2">{item.party}</span>
                    <InlineEdit
                      value={item.total}
                      onSave={(val) => handleUpdateEntry('totals', item.id, 'total', val)}
                      className="justify-end px-2"
                    />
                  </div>
                ))}
                <div className="flex items-center justify-between py-3 bg-blue-50 font-bold text-sm rounded mt-2">
                  <span className="px-2 text-primary">SUBTOTAL</span>
                  <span className="weight-display px-2 text-primary">{formatWeight(calculateSubtotal())}</span>
                </div>
              </div>
            </Card>
          </div>

          <div className="space-y-6">
            <Card className="p-5">
              <h2 className="text-sm font-heading font-bold uppercase tracking-wider mb-4 text-foreground">
                Financial Breakdown
              </h2>
              <div className="space-y-0.5">
                <div className="flex items-center justify-between py-2 border-b border-border font-semibold text-xs text-muted-foreground">
                  <span>NAME</span>
                  <span>AMOUNT (₹)</span>
                </div>
                {dashboardData?.financial?.map((item) => (
                  <div
                    key={item.id}
                    className={cn(
                      "flex items-center justify-between py-2 border-b border-border/50 text-sm",
                      item.highlight && "bg-blue-50/50"
                    )}
                  >
                    <span className="font-medium px-2">{item.name}</span>
                    <InlineEdit
                      value={item.amount}
                      onSave={(val) => handleUpdateEntry('financial', item.id, 'amount', val)}
                      type="number"
                      decimals={0}
                      className="justify-end px-2 font-semibold text-success"
                    />
                  </div>
                ))}
              </div>
            </Card>

            <Card className="p-6 bg-gradient-to-br from-success/20 to-success/10 border-success/30">
              <div className="text-center space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-foreground/80">
                  Grand Total
                </p>
                <p className="text-5xl font-heading font-bold text-success">
                  {formatCurrency(calculateGrandTotal())}
                </p>
              </div>
            </Card>

            <div className="space-y-3">
              <Button className="w-full h-12 bg-primary hover:bg-primary-hover">
                Add Amount
              </Button>
              <Button className="w-full h-12 bg-success hover:bg-success/90 text-success-foreground">
                Confirm
              </Button>
            </div>
          </div>
        </div>
      </div>

      <AddEntryModal
        isOpen={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        onSave={handleAddEntry}
        suppliers={dashboardData?.suppliers || []}
      />
    </div>
  );
};

export default SupplierDashboardPage;
