import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Plus, Save, Download } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table';
import { getDashboardData, formatWeight, formatCurrency } from '../utils/apiAdapter';
import { toast } from 'sonner';

const SupplierDashboardPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);

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

  const handleSave = () => {
    toast.success('Dashboard data saved successfully!');
  };

  const handleExport = () => {
    toast.success('Exporting dashboard data...');
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
      <div className="max-w-[1600px] mx-auto space-y-6">
        {/* Header */}
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
            <Button variant="outline" className="gap-2">
              <Plus className="h-4 w-4" />
              Add New
            </Button>
            <Button onClick={handleSave} variant="outline" className="gap-2">
              <Save className="h-4 w-4" />
              Save
            </Button>
            <Button onClick={handleExport} className="bg-primary hover:bg-primary-hover gap-2">
              <Download className="h-4 w-4" />
              Export
            </Button>
          </div>
        </div>

        {/* Dashboard Content */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 animate-slide-up">
          {/* Left Column - Suppliers & Misc */}
          <div className="xl:col-span-4 space-y-6">
            {/* Joseph's Details */}
            <Card className="p-6">
              <h2 className="text-lg font-heading font-bold uppercase tracking-wider mb-4 text-foreground">
                Joseph
              </h2>
              <div className="rounded-lg border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted">
                      <TableHead className="font-bold">Party</TableHead>
                      <TableHead className="font-bold text-right">A</TableHead>
                      <TableHead className="font-bold text-right">B</TableHead>
                      <TableHead className="font-bold text-right">C</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dashboardData?.suppliers.joseph.subParties.map((party, idx) => (
                      <TableRow key={idx}>
                        <TableCell className="font-medium">{party.name}</TableCell>
                        <TableCell className="text-right weight-display">{formatWeight(party.a)}</TableCell>
                        <TableCell className="text-right weight-display">{formatWeight(party.b)}</TableCell>
                        <TableCell className="text-right weight-display">{formatWeight(party.c)}</TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="bg-muted font-bold">
                      <TableCell>Total</TableCell>
                      <TableCell className="text-right weight-display">
                        {formatWeight(dashboardData?.suppliers.joseph.total.a)}
                      </TableCell>
                      <TableCell className="text-right weight-display">
                        {formatWeight(dashboardData?.suppliers.joseph.total.b)}
                      </TableCell>
                      <TableCell className="text-right weight-display">
                        {formatWeight(dashboardData?.suppliers.joseph.total.c)}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </Card>

            {/* Sadiq's Details */}
            <Card className="p-6">
              <h2 className="text-lg font-heading font-bold uppercase tracking-wider mb-4 text-foreground">
                Sadiq
              </h2>
              <div className="rounded-lg border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted">
                      <TableHead className="font-bold">Party</TableHead>
                      <TableHead className="font-bold text-right">A</TableHead>
                      <TableHead className="font-bold text-right">B</TableHead>
                      <TableHead className="font-bold text-right">C</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dashboardData?.suppliers.sadiq.subParties.map((party, idx) => (
                      <TableRow key={idx}>
                        <TableCell className="font-medium">{party.name}</TableCell>
                        <TableCell className="text-right weight-display">{formatWeight(party.a)}</TableCell>
                        <TableCell className="text-right weight-display">{formatWeight(party.b)}</TableCell>
                        <TableCell className="text-right weight-display">{formatWeight(party.c)}</TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="bg-muted font-bold">
                      <TableCell>Total</TableCell>
                      <TableCell className="text-right weight-display">
                        {formatWeight(dashboardData?.suppliers.sadiq.total.a)}
                      </TableCell>
                      <TableCell className="text-right weight-display">
                        {formatWeight(dashboardData?.suppliers.sadiq.total.b)}
                      </TableCell>
                      <TableCell className="text-right weight-display">
                        {formatWeight(dashboardData?.suppliers.sadiq.total.c)}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </Card>

            {/* Other Calculations */}
            <Card className="p-6">
              <h2 className="text-lg font-heading font-bold uppercase tracking-wider mb-4 text-foreground">
                Other Calculations
              </h2>
              <div className="space-y-3">
                {dashboardData?.suppliers.other.map((item, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-3 rounded-lg bg-accent/50"
                  >
                    <span className="font-medium">{item.name}</span>
                    <span className="weight-display font-semibold">{formatWeight(item.amount)} kg</span>
                  </div>
                ))}
              </div>
            </Card>

            {/* Total Balance */}
            <Card className="p-6 stat-bar-gradient">
              <div className="text-center space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-background/90">
                  Total Balance
                </p>
                <p className="text-4xl font-heading font-bold text-background weight-display">
                  {formatWeight(dashboardData?.subtotal)} kg
                </p>
              </div>
            </Card>
          </div>

          {/* Middle Column - Totals Overview */}
          <div className="xl:col-span-4">
            <Card className="p-6">
              <h2 className="text-lg font-heading font-bold uppercase tracking-wider mb-4 text-foreground">
                Totals Overview
              </h2>
              <div className="rounded-lg border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted">
                      <TableHead className="font-bold">Party</TableHead>
                      <TableHead className="font-bold text-right">Weight (kg)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dashboardData?.totals.map((item, idx) => (
                      <TableRow
                        key={idx}
                        className={item.highlight ? 'bg-destructive/10 hover:bg-destructive/20' : ''}
                      >
                        <TableCell className="font-medium">{item.party}</TableCell>
                        <TableCell className="text-right weight-display font-semibold">
                          {formatWeight(item.weight)}
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="bg-muted">
                      <TableCell className="font-bold">Subtotal</TableCell>
                      <TableCell className="text-right weight-display font-bold">
                        {formatWeight(dashboardData?.subtotal)}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </Card>
          </div>

          {/* Right Column - Financial Breakdown */}
          <div className="xl:col-span-4 space-y-6">
            <Card className="p-6">
              <h2 className="text-lg font-heading font-bold uppercase tracking-wider mb-4 text-foreground">
                Financial Breakdown
              </h2>
              <div className="space-y-3">
                {dashboardData?.financial.map((item, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-4 rounded-lg bg-accent/50"
                  >
                    <span className="font-medium">{item.name}</span>
                    <span className="font-bold text-success">{formatCurrency(item.amount)}</span>
                  </div>
                ))}
              </div>
            </Card>

            {/* Grand Total */}
            <Card className="p-8 bg-gradient-to-br from-success/20 to-success/10 border-success/30">
              <div className="text-center space-y-3">
                <p className="text-sm font-semibold uppercase tracking-wider text-foreground/80">
                  Grand Total
                </p>
                <p className="text-5xl font-heading font-bold text-success">
                  {formatCurrency(dashboardData?.grandTotal)}
                </p>
              </div>
            </Card>

            {/* Action Buttons */}
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
    </div>
  );
};

export default SupplierDashboardPage;
