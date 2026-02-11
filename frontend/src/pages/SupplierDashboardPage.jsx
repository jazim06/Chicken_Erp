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
      <div className=\"min-h-screen bg-background flex items-center justify-center\">
        <div className=\"animate-spin rounded-full h-12 w-12 border-b-2 border-primary\" />
      </div>
    );
  }

  return (
    <div className=\"min-h-screen bg-background py-8 px-4\">
      <div className=\"max-w-[1280px] mx-auto space-y-6\">
        {/* Header */}
        <div className=\"flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 animate-fade-in\">
          <div className=\"space-y-2\">
            <button
              onClick={() => navigate(`/supplier/${id}`)}
              className=\"inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors duration-200 group\"
            >
              <ArrowLeft className=\"h-4 w-4 group-hover:-translate-x-1 transition-transform duration-200\" />
              Supplier Dashboard
            </button>
            <h1 className=\"text-3xl md:text-4xl font-heading font-bold tracking-wide text-foreground\">
              SUPPLIER DASHBOARD
            </h1>
          </div>

          <div className=\"flex flex-wrap gap-3\">
            <Button
              onClick={() => setAddModalOpen(true)}
              className=\"gap-2 bg-primary hover:bg-primary-hover\"
            >
              <Plus className=\"h-4 w-4\" />
              Add New
            </Button>
            <Button onClick={handleSave} variant=\"outline\" className=\"gap-2\">
              <Save className=\"h-4 w-4\" />
              Save
            </Button>
            <Button onClick={handleExport} variant=\"outline\" className=\"gap-2\">
              <Download className=\"h-4 w-4\" />
              Export
            </Button>
          </div>
        </div>

        {/* Dashboard Grid */}
        <div className=\"grid grid-cols-1 xl:grid-cols-3 gap-6 animate-slide-up\">
          {/* Left Column - SUPPLIERS & MISC */}
          <div className=\"space-y-6\">
            {/* Supplier Tables */}
            {dashboardData?.suppliers?.map((supplier) => (
              <Card key={supplier.id} className=\"p-5\">\n                <h2 className=\"text-sm font-heading font-bold uppercase tracking-wider mb-4 text-foreground\">\n                  {supplier.name}\n                </h2>\n                <div className=\"overflow-x-auto\">\n                  <table className=\"w-full text-sm\">\n                    <thead>\n                      <tr className=\"border-b border-border\">\n                        <th className=\"text-left py-2 px-2 font-semibold text-muted-foreground\">Item</th>\n                        <th className=\"text-right py-2 px-2 font-semibold text-muted-foreground\">A</th>\n                        <th className=\"text-right py-2 px-2 font-semibold text-muted-foreground\">B</th>\n                        <th className=\"text-right py-2 px-2 font-semibold text-muted-foreground\">C</th>\n                      </tr>\n                    </thead>\n                    <tbody>\n                      {supplier.rows.map((row) => (\n                        <tr key={row.id} className=\"border-b border-border/50\">\n                          <td className=\"py-2 px-2 font-medium\">{row.party}</td>\n                          <td className=\"text-right py-2 px-2\">\n                            <InlineEdit\n                              value={row.a}\n                              onSave={(val) => handleUpdateEntry('supplier', supplier.id, { rowId: row.id, column: 'a' }, val)}\n                              className=\"justify-end\"\n                            />\n                          </td>\n                          <td className=\"text-right py-2 px-2\">\n                            <InlineEdit\n                              value={row.b}\n                              onSave={(val) => handleUpdateEntry('supplier', supplier.id, { rowId: row.id, column: 'b' }, val)}\n                              className=\"justify-end\"\n                            />\n                          </td>\n                          <td className=\"text-right py-2 px-2\">\n                            <InlineEdit\n                              value={row.c}\n                              onSave={(val) => handleUpdateEntry('supplier', supplier.id, { rowId: row.id, column: 'c' }, val)}\n                              className=\"justify-end\"\n                            />\n                          </td>\n                        </tr>\n                      ))}\n                      <tr className=\"bg-muted/50 font-bold\">\n                        <td className=\"py-2 px-2\">Total</td>\n                        <td colSpan=\"3\" className=\"text-right py-2 px-2 weight-display\">\n                          {formatWeight(calculateSupplierTotal(supplier.rows))}\n                        </td>\n                      </tr>\n                    </tbody>\n                  </table>\n                </div>\n              </Card>\n            ))}\n\n            {/* Other Calculations */}\n            <Card className=\"p-5\">\n              <h2 className=\"text-sm font-heading font-bold uppercase tracking-wider mb-4 text-foreground\">\n                Other Calculations\n              </h2>\n              <div className=\"space-y-1\">\n                <div className=\"text-xs font-semibold text-primary mb-2\">\n                  {dashboardData?.otherCalculations?.title}\n                </div>\n                {dashboardData?.otherCalculations?.items?.map((item) => (\n                  <div\n                    key={item.id}\n                    className=\"flex items-center justify-between py-2 border-b border-border/50 text-sm\"\n                  >\n                    <span className=\"font-medium\">{item.name}</span>\n                    <InlineEdit\n                      value={item.value}\n                      onSave={(val) => handleUpdateEntry('other', item.id, 'value', val)}\n                      className=\"justify-end\"\n                    />\n                  </div>\n                ))}\n                <div className=\"flex items-center justify-between py-2 bg-muted/50 font-bold text-sm rounded mt-2\">\n                  <span className=\"px-2\">Total</span>\n                  <span className=\"weight-display px-2\">{formatWeight(calculateOtherTotal())}</span>\n                </div>\n              </div>\n            </Card>\n\n            {/* Total Balance */}\n            <Card className=\"p-6 stat-bar-gradient\">\n              <div className=\"text-center space-y-2\">\n                <p className=\"text-xs font-semibold uppercase tracking-wider text-background/90\">\n                  Total Balance\n                </p>\n                <p className=\"text-4xl font-heading font-bold text-background weight-display\">\n                  {formatWeight(calculateTotalBalance())} kg\n                </p>\n              </div>\n            </Card>\n          </div>\n\n          {/* Middle Column - TOTALS OVERVIEW */}\n          <div>\n            <Card className=\"p-5\">\n              <h2 className=\"text-sm font-heading font-bold uppercase tracking-wider mb-4 text-foreground\">\n                Totals Overview\n              </h2>\n              <div className=\"space-y-1\">\n                {dashboardData?.totalsOverview?.map((item) => (\n                  <div\n                    key={item.id}\n                    className={cn(\n                      \"flex items-center justify-between py-2 border-b border-border/50 text-sm\",\n                      item.highlight && \"bg-blue-50/50\"\n                    )}\n                  >\n                    <span className=\"font-medium px-2\">{item.party}</span>\n                    <InlineEdit\n                      value={item.total}\n                      onSave={(val) => handleUpdateEntry('totals', item.id, 'total', val)}\n                      className=\"justify-end px-2\"\n                    />\n                  </div>\n                ))}\n                <div className=\"flex items-center justify-between py-3 bg-blue-50 font-bold text-sm rounded mt-2\">\n                  <span className=\"px-2 text-primary\">SUBTOTAL</span>\n                  <span className=\"weight-display px-2 text-primary\">{formatWeight(calculateSubtotal())}</span>\n                </div>\n              </div>\n            </Card>\n          </div>\n\n          {/* Right Column - FINANCIAL BREAKDOWN */}\n          <div className=\"space-y-6\">\n            <Card className=\"p-5\">\n              <h2 className=\"text-sm font-heading font-bold uppercase tracking-wider mb-4 text-foreground\">\n                Financial Breakdown\n              </h2>\n              <div className=\"space-y-0.5\">\n                <div className=\"flex items-center justify-between py-2 border-b border-border font-semibold text-xs text-muted-foreground\">\n                  <span>NAME</span>\n                  <span>AMOUNT (₹)</span>\n                </div>\n                {dashboardData?.financial?.map((item) => (\n                  <div\n                    key={item.id}\n                    className={cn(\n                      \"flex items-center justify-between py-2 border-b border-border/50 text-sm\",\n                      item.highlight && \"bg-blue-50/50\"\n                    )}\n                  >\n                    <span className=\"font-medium px-2\">{item.name}</span>\n                    <InlineEdit\n                      value={item.amount}\n                      onSave={(val) => handleUpdateEntry('financial', item.id, 'amount', val)}\n                      type=\"number\"\n                      decimals={0}\n                      className=\"justify-end px-2 font-semibold text-success\"\n                    />\n                  </div>\n                ))}\n              </div>\n            </Card>\n\n            {/* Grand Total */}\n            <Card className=\"p-6 bg-gradient-to-br from-success/20 to-success/10 border-success/30\">\n              <div className=\"text-center space-y-2\">\n                <p className=\"text-xs font-semibold uppercase tracking-wider text-foreground/80\">\n                  Grand Total\n                </p>\n                <p className=\"text-5xl font-heading font-bold text-success\">\n                  {formatCurrency(calculateGrandTotal())}\n                </p>\n              </div>\n            </Card>\n\n            {/* Action Buttons */}\n            <div className=\"space-y-3\">\n              <Button className=\"w-full h-12 bg-primary hover:bg-primary-hover\">\n                Add Amount\n              </Button>\n              <Button className=\"w-full h-12 bg-success hover:bg-success/90 text-success-foreground\">\n                Confirm\n              </Button>\n            </div>\n          </div>\n        </div>\n      </div>\n\n      {/* Add Entry Modal */}\n      <AddEntryModal\n        isOpen={addModalOpen}\n        onClose={() => setAddModalOpen(false)}\n        onSave={handleAddEntry}\n        suppliers={dashboardData?.suppliers || []}\n      />\n    </div>\n  );\n};\n\nexport default SupplierDashboardPage;
