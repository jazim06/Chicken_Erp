import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Plus, Download, X, ChevronLeft, ChevronRight, Calendar as CalendarIcon, Pencil, Check, Users } from 'lucide-react';
import { format, addDays, subDays } from 'date-fns';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Calendar } from '../components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '../components/ui/popover';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import {
  getDashboardData,
  updateDashboardEntry,
  createDashboardEntry,
  createDeductionEntry,
  updateDeductionEntry,
  deleteDeductionEntry,
  updatePriceRate,
  updateRMSEntry,
  updateATBEntry,
  createCustomFinancialEntry,
  updateCustomFinancialEntry,
  deleteCustomFinancialEntry,
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
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [addFormulaModalOpen, setAddFormulaModalOpen] = useState(false);
  const [editingCell, setEditingCell] = useState(null);
  const [editValue, setEditValue] = useState('');

  // Add entry form state
  const [addEntryType, setAddEntryType] = useState('totals');
  const [addEntryData, setAddEntryData] = useState({ name: '', value: '' });

  // Add formula form state
  const [formulaData, setFormulaData] = useState({ name: '', formula: '', value: '' });

  // Bulk deduction editing state
  const [deductionValues, setDeductionValues] = useState({});
  const [customParties, setCustomParties] = useState([]);
  const [savingDeductions, setSavingDeductions] = useState(false);
  const [yesterdayStock, setYesterdayStock] = useState('');
  const [savingStock, setSavingStock] = useState(false);

  // PR Rate editing state
  const [editingRate, setEditingRate] = useState(false);
  const [editRateValue, setEditRateValue] = useState('');

  // ATB (Amount To Be Paid) rate
  const [atbRate, setAtbRate] = useState('');
  const [savingAtb, setSavingAtb] = useState(false);

  // RMS editing state
  const [editingRms, setEditingRms] = useState(false);
  const [rmsValue, setRmsValue] = useState('');
  const [savingRms, setSavingRms] = useState(false);

  // Financial breakdown local state (editable)
  const [financialEntries, setFinancialEntries] = useState([]);
  const [editingFinWeight, setEditingFinWeight] = useState(null); // entry id being edited
  const [editingFinAmount, setEditingFinAmount] = useState(null); // entry id being edited
  const [finWeightValue, setFinWeightValue] = useState('');
  const [finAmountValue, setFinAmountValue] = useState('');
  const [addFinPartyName, setAddFinPartyName] = useState('');
  const [showAddFinEntry, setShowAddFinEntry] = useState(false);

  // Hardcoded deduction party list
  const DEDUCTION_PARTIES = [
    'Thamim', 'Irfan', 'Rajendran', 'BBC', 'Parveen',
    'Masthan', 'AL Ayaan', 'MBB', 'F', 'Anas', 'Iruppu'
  ];

  const dateStr = format(selectedDate, 'yyyy-MM-dd');

  useEffect(() => {
    loadDashboard();
  }, [id, dateStr]);

  // Sync yesterday stock from dashboard data
  useEffect(() => {
    if (dashboardData) {
      const stockItem = dashboardData.totalsOverview?.find(i => i.id === 'yesterday_stock');
      setYesterdayStock(stockItem?.total || 0);
      // Sync ATB rate from persisted data
      if (dashboardData.atbRate) {
        setAtbRate(String(dashboardData.atbRate));
      }
      // Sync financial entries for local editing
      if (dashboardData.financial) {
        setFinancialEntries(dashboardData.financial.map(item => ({ ...item })));
      }
    }
  }, [dashboardData]);

  // Sync deduction values from dashboard data
  useEffect(() => {
    if (dashboardData?.deductions) {
      const values = {};
      const customPartiesFromData = [];
      dashboardData.deductions.forEach(ded => {
        values[ded.partyName] = ded.amount;
        // Track custom parties (not in hardcoded list)
        if (!DEDUCTION_PARTIES.includes(ded.partyName)) {
          customPartiesFromData.push(ded.partyName);
        }
      });
      setDeductionValues(values);
      setCustomParties(customPartiesFromData);
    }
  }, [dashboardData]);

  const handleSaveYesterdayStock = async (value) => {
    setSavingStock(true);
    try {
      const prevDate = format(subDays(selectedDate, 1), 'yyyy-MM-dd');
      await fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'}/api/carryover`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer dev-hardcoded-token' },
        body: JSON.stringify({ date: prevDate, balance: parseFloat(value) || 0 }),
      });
      await loadDashboard();
      toast.success('Yesterday stock updated');
    } catch {
      toast.error('Failed to save yesterday stock');
    } finally {
      setSavingStock(false);
    }
  };

  const loadDashboard = async () => {
    setLoading(true);
    try {
      const data = await getDashboardData(id, dateStr);
      setDashboardData(data);
    } catch (error) {
      console.error('Failed to load dashboard:', error);
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const handleCellClick = (type, itemId, field, currentValue) => {
    setEditingCell({ type, itemId, field });
    setEditValue(currentValue);
  };

  const handleCellSave = async () => {
    if (!editingCell) return;
    
    try {
      await updateDashboardEntry(
        editingCell.type,
        editingCell.itemId,
        editingCell.field,
        editValue
      );
      await loadDashboard();
      setEditingCell(null);
      toast.success('Updated successfully');
    } catch (error) {
      toast.error('Failed to update');
    }
  };

  const handleCellKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleCellSave();
    } else if (e.key === 'Escape') {
      setEditingCell(null);
    }
  };

  const handleAddEntry = async () => {
    try {
      const payload = {
        type: addEntryType,
        ...addEntryData
      };
      const updated = await createDashboardEntry(addEntryType, payload);
      await loadDashboard();
      setAddModalOpen(false);
      setAddEntryData({ name: '', value: '' });
      toast.success('Entry added successfully');
    } catch (error) {
      toast.error('Failed to add entry');
    }
  };

  const handleAddCustomParty = () => {
    const partyName = prompt('Enter custom party name:');
    if (partyName && partyName.trim()) {
      const trimmedName = partyName.trim();
      if (!DEDUCTION_PARTIES.includes(trimmedName) && !customParties.includes(trimmedName)) {
        setCustomParties(prev => [...prev, trimmedName]);
        toast.success(`Added custom party: ${trimmedName}`);
      } else {
        toast.error('Party already exists');
      }
    }
  };

  const handleRemoveCustomParty = (partyName) => {
    setCustomParties(prev => prev.filter(p => p !== partyName));
    setDeductionValues(prev => {
      const newValues = { ...prev };
      delete newValues[partyName];
      return newValues;
    });
  };

  const handleSaveAllDeductions = async () => {
    setSavingDeductions(true);
    try {
      // Filter out zero/empty values and prepare payload
      const deductions = Object.entries(deductionValues)
        .filter(([_, amount]) => amount && parseFloat(amount) > 0)
        .map(([partyName, amount]) => ({
          partyName,
          amount: parseFloat(amount),
          date: dateStr,
        }));

      // Call bulk API endpoint
      await fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'}/api/deduction-entries/bulk`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer dev-hardcoded-token',
        },
        body: JSON.stringify({ date: dateStr, deductions }),
      });

      await loadDashboard();
      toast.success('Deductions saved successfully');
    } catch (error) {
      toast.error('Failed to save deductions');
    } finally {
      setSavingDeductions(false);
    }
  };

  const handleSaveRate = async () => {
    const val = parseFloat(editRateValue);
    if (!val || val <= 0) { toast.error('Enter a valid rate'); return; }
    try {
      await updatePriceRate({ ratePerKg: val, date: dateStr, productTypeId: 'chicken' });
      await loadDashboard();
      setEditingRate(false);
      toast.success('PR Rate updated');
    } catch (error) {
      toast.error('Failed to update rate');
    }
  };



  const handleAddFormula = async () => {
    try {
      const payload = {
        name: formulaData.name,
        amount: parseFloat(formulaData.value) || 0,
        formula: formulaData.formula
      };
      const updated = await createDashboardEntry('financial', payload);
      await loadDashboard();
      setAddFormulaModalOpen(false);
      setFormulaData({ name: '', formula: '', value: '' });
      toast.success('Formula added successfully');
    } catch (error) {
      toast.error('Failed to add formula');
    }
  };

  const handleExport = () => {
    try {
      let csv = `Dashboard Export - ${format(selectedDate, 'PPP')}\n\n`;

      // Suppliers section
      csv += 'SUPPLIERS\n';
      csv += 'Name,A (Load),B (Empty),C (Live)\n';
      dashboardData?.suppliers?.forEach(supp => {
        supp.subParties.forEach(sp => {
          csv += `${sp.name},${sp.a || 0},${sp.b || 0},${sp.c || 0}\n`;
        });
        csv += `${supp.name} TOTAL,,,${supp.total || 0}\n`;
      });

      // Totals Overview
      csv += '\nTOTALS OVERVIEW\n';
      csv += 'Item,Weight (kg)\n';
      dashboardData?.totalsOverview?.forEach(item => {
        csv += `${item.label || item.name},${item.total || item.value || 0}\n`;
      });
      csv += `SUBTOTAL,${calculateSubtotal()}\n`;

      // Financial Breakdown
      csv += '\nFINANCIAL BREAKDOWN\n';
      csv += 'Party,Weight (kg),Rate,Amount\n';
      dashboardData?.financialBreakdown?.forEach(item => {
        csv += `${item.name},${item.weight || 0},${item.rate || 0},${item.amount || 0}\n`;
      });
      csv += `GRAND TOTAL,,,${dashboardData?.grandTotal || 0}\n`;

      // Deductions
      if (dashboardData?.deductions?.length > 0) {
        csv += '\nDEDUCTIONS\n';
        csv += 'Party,Weight (kg)\n';
        dashboardData.deductions.forEach(ded => {
          csv += `${ded.partyName},${ded.amount}\n`;
        });
      }

      // Download
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `dashboard_${format(selectedDate, 'yyyy-MM-dd')}.csv`;
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success('Dashboard exported successfully');
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Failed to export dashboard');
    }
  };

  // Memoized calculations — only recompute when dashboardData changes
  const calculateSupplierTotal = useCallback(
    (rows) => rows.reduce((sum, row) => sum + (row.c || 0), 0),
    []
  );

  const otherTotal = useMemo(() => {
    if (!dashboardData?.otherCalculations?.items) return 0;
    return dashboardData.otherCalculations.items.reduce((sum, item) => sum + (item.value || 0), 0);
  }, [dashboardData?.otherCalculations]);

  const subtotal = useMemo(() => {
    if (!dashboardData?.totalsOverview) return 0;
    return dashboardData.totalsOverview.reduce((sum, item) => sum + (item.total || 0), 0);
  }, [dashboardData?.totalsOverview]);

  // Keep old function signatures for JSX compatibility
  const calculateOtherTotal = () => otherTotal;
  const calculateSubtotal = () => subtotal;

  // Custom formulas for recalculating amount from weight
  const CUSTOM_FORMULAS = useMemo(() => ({
    'Parveen': (w, r) => Math.round(((r - 3) * w) * 100) / 100,
    'Anna city': (w, r) => Math.round(((w * 1.5) * (r + 4)) * 100) / 100,
    'Saleem Bhai': (w, r) => Math.round(((w * 1.6) * (r + 5)) * 100) / 100,
  }), []);

  const calculateGrandTotal = () => {
    // Use local financial entries for grand total
    if (financialEntries.length > 0) {
      return financialEntries.reduce((sum, item) => sum + (item.amount || 0), 0);
    }
    return dashboardData?.financialTotal || 0;
  };

  const recalcAmount = (name, weight, rate) => {
    const formula = CUSTOM_FORMULAS[name];
    if (formula && weight > 0) return formula(weight, rate);
    return weight > 0 ? Math.round(weight * rate * 100) / 100 : 0;
  };

  // Handlers for financial entry editing
  const handleFinWeightSave = (item) => {
    const newWeight = parseFloat(finWeightValue) || 0;
    const rate = item.ratePerKg || 0;
    const newAmount = recalcAmount(item.name, newWeight, rate);
    setFinancialEntries(prev =>
      prev.map(e => e.id === item.id ? { ...e, weight: newWeight, amount: newAmount } : e)
    );
    setEditingFinWeight(null);
    // Persist if custom entry
    if (item.isCustom) {
      updateCustomFinancialEntry(item.id, { weight: newWeight, amount: newAmount }).catch(() => {});
    }
  };

  const handleFinAmountSave = (item) => {
    const newAmount = parseFloat(finAmountValue) || 0;
    setFinancialEntries(prev =>
      prev.map(e => e.id === item.id ? { ...e, amount: newAmount } : e)
    );
    setEditingFinAmount(null);
    // Persist if custom entry
    if (item.isCustom) {
      updateCustomFinancialEntry(item.id, { amount: newAmount }).catch(() => {});
    }
  };

  const handleAddFinEntry = async () => {
    const name = addFinPartyName.trim();
    if (!name) return;
    try {
      const result = await createCustomFinancialEntry({
        partyName: name,
        weight: 0,
        amount: 0,
        date: dateStr,
        productType: 'chicken',
      });
      setFinancialEntries(prev => [...prev, {
        id: result.id,
        name: result.partyName,
        weight: 0,
        ratePerKg: dashboardData?.priceRate || 0,
        amount: 0,
        formula: null,
        isRms: false,
        isCustom: true,
      }]);
      setAddFinPartyName('');
      setShowAddFinEntry(false);
      toast.success(`Added ${name}`);
    } catch (err) {
      toast.error('Failed to add entry');
    }
  };

  const handleRemoveFinEntry = async (item) => {
    if (item.isCustom) {
      try {
        await deleteCustomFinancialEntry(item.id);
        toast.success(`Removed ${item.name}`);
      } catch (err) {
        toast.error('Failed to remove entry');
      }
    }
    setFinancialEntries(prev => prev.filter(e => e.id !== item.id));
  };

  const calculateTotalBalance = () => {
    return calculateSubtotal();
  };

  const EditableCell = ({ value, type, itemId, field, decimals = 3, isAmount = false }) => {
    const isEditing = editingCell?.type === type && editingCell?.itemId === itemId && editingCell?.field === field;

    if (isEditing) {
      return (
        <input
          type="number"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={handleCellSave}
          onKeyDown={handleCellKeyDown}
          className="w-full px-2 py-1 text-sm text-right border-2 border-blue-500 rounded bg-blue-50 focus:outline-none font-mono"
          autoFocus
          step="0.001"
        />
      );
    }

    return (
      <div
        onClick={() => handleCellClick(type, itemId, field, value)}
        className="cursor-pointer px-2 py-1 hover:bg-gray-100 rounded transition-colors font-mono text-right"
      >
        {isAmount ? formatCurrency(value).replace('₹', '₹ ') : typeof value === 'number' ? value.toFixed(decimals) : value}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top Bar */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-200 h-16">
        <div className="max-w-[1400px] mx-auto px-6 h-full flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/suppliers?product=chicken')}
              className="text-gray-600 hover:text-gray-900 transition-colors"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <h1 className="text-xl font-semibold text-gray-900">Supplier Dashboard</h1>
          </div>

          {/* Date Navigation */}
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedDate(prev => subDays(prev, 1))}
              className="h-8 w-8 p-0"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "justify-start text-left font-normal h-9 px-3 text-sm",
                    !selectedDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {format(selectedDate, 'PPP')}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="center">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={(d) => d && setSelectedDate(d)}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedDate(prev => addDays(prev, 1))}
              className="h-8 w-8 p-0"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex items-center gap-3">
            {/* Editable PR Rate */}
            {editingRate ? (
              <div className="flex items-center gap-1">
                <span className="text-sm text-gray-600">PR Rate:</span>
                <Input
                  type="number"
                  value={editRateValue}
                  onChange={(e) => setEditRateValue(e.target.value)}
                  className="h-8 w-20 text-sm"
                  autoFocus
                  onKeyDown={(e) => { if (e.key === 'Enter') handleSaveRate(); if (e.key === 'Escape') setEditingRate(false); }}
                />
                <button onClick={handleSaveRate} className="text-green-600 hover:text-green-800">
                  <Check className="h-4 w-4" />
                </button>
                <button onClick={() => setEditingRate(false)} className="text-gray-400 hover:text-gray-600">
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => { setEditRateValue(dashboardData?.effectivePrRate || 177); setEditingRate(true); }}
                className="flex items-center gap-1 text-sm text-gray-600 hover:text-blue-600 transition-colors cursor-pointer"
              >
                PR Rate: <span className="font-semibold">{dashboardData?.effectivePrRate || 177}</span>
                <Pencil className="h-3 w-3 ml-0.5" />
              </button>
            )}

            {/* Suppliers Navigation */}
            <Button
              variant="outline"
              onClick={() => navigate('/suppliers?product=chicken')}
              className="h-9 px-3 text-sm"
            >
              <Users className="h-4 w-4 mr-1" />
              Suppliers
            </Button>

            <Button
              onClick={handleExport}
              variant="outline"
              className="h-9 px-4 text-sm bg-green-50 hover:bg-green-100 text-green-700 border-green-200"
            >
              <Download className="h-4 w-4 mr-1" />
              Export CSV
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-[1400px] mx-auto px-6 py-6">
        <div className="grid grid-cols-[1.1fr_1.3fr_1fr] gap-6">
          {/* LEFT COLUMN */}
          <div className="space-y-6">
            {/* Suppliers & Misc Header */}
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              SUPPLIERS & MISC
            </div>

            {/* Joseph Card */}
            {dashboardData?.suppliers?.map((supplier) => (
              <Card key={supplier.id} className="p-4 shadow-sm">
                <h3 className="text-sm font-semibold text-gray-900 mb-3">{supplier.name}</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200">
                        <th className="text-left py-2 px-2 font-semibold text-gray-600">Item</th>
                        <th className="text-right py-2 px-2 font-semibold text-gray-600 w-20">A</th>
                        <th className="text-right py-2 px-2 font-semibold text-gray-600 w-20">B</th>
                        <th className="text-right py-2 px-2 font-semibold text-gray-600 w-20">C</th>
                      </tr>
                    </thead>
                    <tbody>
                      {supplier.rows.map((row) => (
                        <tr key={row.id} className="border-b border-gray-100 hover:bg-gray-50">
                          <td className="py-2 px-2 text-gray-900">{row.party}</td>
                          <td className="text-right py-2 px-2 text-gray-700">
                            <EditableCell
                              value={row.a}
                              type="supplier"
                              itemId={supplier.id}
                              field={{ rowId: row.id, column: 'a' }}
                            />
                          </td>
                          <td className="text-right py-2 px-2 text-gray-700">
                            <EditableCell
                              value={row.b}
                              type="supplier"
                              itemId={supplier.id}
                              field={{ rowId: row.id, column: 'b' }}
                            />
                          </td>
                          <td className="text-right py-2 px-2 text-gray-700">
                            <EditableCell
                              value={row.c}
                              type="supplier"
                              itemId={supplier.id}
                              field={{ rowId: row.id, column: 'c' }}
                            />
                          </td>
                        </tr>
                      ))}
                      <tr className="bg-gray-50 font-bold">
                        <td className="py-2 px-2 text-gray-900">Total</td>
                        <td colSpan="3" className="text-right py-2 px-2 font-mono text-gray-900">
                          {formatWeight(calculateSupplierTotal(supplier.rows))}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </Card>
            ))}

            {/* Other Calculations Card */}
            <Card className="p-4 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  OTHER CALCULATIONS
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => { setAddEntryType('other'); setAddModalOpen(true); }}
                  className="h-7 px-2 text-xs text-yellow-600 hover:text-yellow-700 hover:bg-yellow-50"
                >
                  <Plus className="h-3 w-3 mr-1" />
                  Add Entry
                </Button>
              </div>
              <div className="bg-yellow-50 px-3 py-1 rounded text-xs font-semibold text-yellow-700 mb-2 inline-block">
                {dashboardData?.otherCalculations?.title}
              </div>
              <div className="space-y-1">
                {dashboardData?.otherCalculations?.items?.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between py-2 border-b border-gray-100 text-xs"
                  >
                    <span className="text-gray-900">{item.name}</span>
                    <EditableCell
                      value={item.value}
                      type="other"
                      itemId={item.id}
                      field="value"
                    />
                  </div>
                ))}
                <div className="flex items-center justify-between py-2 bg-gray-50 font-bold text-xs rounded mt-2 px-2">
                  <span className="text-gray-900">Total</span>
                  <span className="font-mono text-gray-900">{formatWeight(calculateOtherTotal())}</span>
                </div>
              </div>
            </Card>
          </div>

          {/* CENTER COLUMN */}
          <div className="space-y-6">
            <Card className="p-4 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wider">Totals Overview</h2>
              </div>
              <div className="space-y-1">
                {dashboardData?.totalsOverview?.map((item) => (
                  <div
                    key={item.id}
                    className={`flex items-center justify-between py-2 border-b border-gray-100 text-sm ${
                      item.id === 'yesterday_stock' ? 'bg-amber-50' : ''
                    }`}
                  >
                    <span className={`px-2 ${
                      item.id === 'yesterday_stock' ? 'font-semibold text-amber-700' : 'text-gray-900'
                    }`}>{item.party}</span>
                    {item.id === 'yesterday_stock' ? (
                      <div className="flex items-center gap-1 px-2">
                        <input
                          type="number"
                          value={yesterdayStock}
                          onChange={(e) => setYesterdayStock(e.target.value)}
                          onBlur={(e) => handleSaveYesterdayStock(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && handleSaveYesterdayStock(e.target.value)}
                          className="w-24 px-2 py-1 text-right font-mono text-sm border border-amber-300 rounded bg-white focus:outline-none focus:ring-2 focus:ring-amber-400"
                          placeholder="0"
                          step="0.001"
                          disabled={savingStock}
                        />
                      </div>
                    ) : (
                      <span className="font-mono px-2 text-gray-900">{formatWeight(item.total)}</span>
                    )}
                  </div>
                ))}
                <div className="flex items-center justify-between py-3 bg-blue-50 font-bold text-sm rounded mt-2">
                  <span className="px-2 text-blue-600 uppercase text-xs tracking-wider">Subtotal</span>
                  <span className="font-mono px-2 text-blue-600">{formatWeight(dashboardData?.subtotal || 0)}</span>
                </div>
              </div>

              {/* Deductions Section - Bulk Edit */}
              <div className="mt-4 pt-3 border-t border-gray-200">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-semibold text-red-600 uppercase tracking-wider">Deductions</h3>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleAddCustomParty}
                      className="h-7 px-2 text-xs text-red-600 hover:text-red-700 border-red-200 hover:bg-red-50"
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      Add Entry
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleSaveAllDeductions}
                      disabled={savingDeductions}
                      className="h-7 px-3 text-xs bg-red-600 hover:bg-red-700 text-white"
                    >
                      {savingDeductions ? 'Saving...' : 'Save All'}
                    </Button>
                  </div>
                </div>
                
                <div className="space-y-1 max-h-96 overflow-y-auto">
                  {/* Standard parties */}
                  {DEDUCTION_PARTIES.map(party => (
                    <div key={party} className="flex items-center justify-between py-1.5 px-2 border-b border-gray-100">
                      <span className="text-sm text-gray-700 w-32 flex-shrink-0">{party}</span>
                      <Input
                        type="number"
                        value={deductionValues[party] || ''}
                        onChange={(e) => setDeductionValues(prev => ({ ...prev, [party]: e.target.value }))}
                        placeholder="0.000"
                        step="0.001"
                        className="h-8 w-28 text-right font-mono text-sm"
                      />
                      <span className="text-xs text-gray-400 ml-2 w-8">kg</span>
                    </div>
                  ))}
                  
                  {/* Custom parties */}
                  {customParties.length > 0 && (
                    <div className="pt-2 mt-2 border-t border-gray-300">
                      <p className="text-xs text-gray-500 px-2 mb-1">Custom Entries</p>
                      {customParties.map(party => (
                        <div key={party} className="flex items-center justify-between py-1.5 px-2 border-b border-gray-100 bg-red-50/30 group">
                          <span className="text-sm text-gray-700 w-32 flex-shrink-0">{party}</span>
                          <Input
                            type="number"
                            value={deductionValues[party] || ''}
                            onChange={(e) => setDeductionValues(prev => ({ ...prev, [party]: e.target.value }))}
                            placeholder="0.000"
                            step="0.001"
                            className="h-8 w-28 text-right font-mono text-sm"
                          />
                          <div className="flex items-center gap-1">
                            <span className="text-xs text-gray-400 w-8">kg</span>
                            <button
                              onClick={() => handleRemoveCustomParty(party)}
                              className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 transition-opacity ml-1"
                              title="Remove custom entry"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                
                <div className="flex items-center justify-between py-2 bg-red-50 font-bold text-sm rounded mt-3">
                  <span className="px-2 text-red-600 uppercase text-xs tracking-wider">Total Deductions</span>
                  <span className="font-mono px-2 text-red-600">
                    -{formatWeight(dashboardData?.totalDeductions || 0)}
                  </span>
                </div>
              </div>
            </Card>

            {/* Total Balance Card */}
            <Card className="p-6 shadow-sm bg-gradient-to-br from-gray-50 to-white border border-gray-200">
              <div className="text-center space-y-2">
                <p className="text-sm font-semibold text-gray-600 uppercase tracking-wider">
                  Total Balance
                </p>
                <p className="text-4xl font-bold text-gray-900 font-mono">
                  {formatWeight(dashboardData?.totalBalance || 0)}
                </p>
              </div>
            </Card>

            {/* ATB (Amount To Be Paid) Card */}
            <Card className="p-6 shadow-sm bg-gradient-to-br from-green-50 to-white border-2 border-green-200">
              <div className="text-center space-y-3">
                <p className="text-sm font-semibold text-green-700 uppercase tracking-wider">
                  Amount To Be Paid (ATB)
                </p>
                <div className="flex items-center justify-center gap-2 text-lg font-semibold text-gray-700">
                  <span className="font-mono">{formatWeight(dashboardData?.totalBalance || 0)}</span>
                  <span>kg</span>
                  <span className="text-green-600">×</span>
                  <input
                    type="number"
                    value={atbRate}
                    onChange={(e) => setAtbRate(e.target.value)}
                    placeholder="0"
                    step="0.01"
                    min="0"
                    className="w-28 h-9 px-2 border-2 border-green-300 rounded-md text-center font-mono focus:outline-none focus:ring-2 focus:ring-green-400 focus:border-transparent"
                  />
                  <span>₹/kg</span>
                  <Button
                    size="sm"
                    className="bg-green-600 hover:bg-green-700 text-white h-9 px-4"
                    disabled={savingAtb}
                    onClick={async () => {
                      setSavingAtb(true);
                      try {
                        await updateATBEntry(dateStr, parseFloat(atbRate) || 0);
                        toast.success('ATB rate saved');
                      } catch (err) {
                        toast.error('Failed to save ATB rate');
                      }
                      setSavingAtb(false);
                    }}
                  >
                    {savingAtb ? '...' : 'Save'}
                  </Button>
                </div>
                {atbRate && parseFloat(atbRate) > 0 && (
                  <div className="pt-2 border-t border-green-200">
                    <p className="text-sm text-gray-600 mb-1">Total Amount</p>
                    <p className="text-3xl font-bold text-green-600 font-mono">
                      ₹{((dashboardData?.totalBalance || 0) * parseFloat(atbRate)).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                  </div>
                )}
              </div>
            </Card>
          </div>

          {/* RIGHT COLUMN */}
          <div className="space-y-6">
            <Card className="p-4 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wider">Financial Breakdown</h2>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 px-2 text-xs border-blue-300 text-blue-600 hover:bg-blue-50"
                  onClick={() => setShowAddFinEntry(true)}
                >
                  <Plus className="h-3 w-3 mr-1" /> Add Entry
                </Button>
              </div>

              {/* Add Entry Inline Form */}
              {showAddFinEntry && (
                <div className="flex items-center gap-2 mb-3 p-2 bg-blue-50 rounded border border-blue-200">
                  <input
                    type="text"
                    value={addFinPartyName}
                    onChange={(e) => setAddFinPartyName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleAddFinEntry();
                      if (e.key === 'Escape') { setShowAddFinEntry(false); setAddFinPartyName(''); }
                    }}
                    placeholder="Party name"
                    autoFocus
                    className="flex-1 h-7 px-2 text-sm border border-blue-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-400"
                  />
                  <Button
                    size="sm"
                    className="h-7 px-3 bg-blue-600 hover:bg-blue-700 text-white text-xs"
                    onClick={handleAddFinEntry}
                    disabled={!addFinPartyName.trim()}
                  >
                    Add
                  </Button>
                  <button
                    onClick={() => { setShowAddFinEntry(false); setAddFinPartyName(''); }}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              )}

              <div className="space-y-0.5">
                <div className="flex items-center py-2 border-b border-gray-200 font-semibold text-xs text-gray-600">
                  <span className="flex-1">NAME</span>
                  <span className="w-24 text-right">WEIGHT</span>
                  <span className="w-28 text-right">AMOUNT (₹)</span>
                  <span className="w-6"></span>
                </div>
                {financialEntries.map(item => (
                  <div key={item.id} className="group border-b border-gray-100 hover:bg-gray-50">
                    <div className="flex items-center py-2 text-sm">
                      <span className="text-gray-900 px-2 flex-1">{item.name}</span>

                      {/* WEIGHT COLUMN */}
                      {item.isRms ? (
                        <span className="text-gray-400 px-2 font-mono text-xs w-24 text-right">—</span>
                      ) : editingFinWeight === item.id ? (
                        <span className="w-24 text-right px-1">
                          <input
                            type="number"
                            value={finWeightValue}
                            onChange={(e) => setFinWeightValue(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleFinWeightSave(item);
                              if (e.key === 'Escape') setEditingFinWeight(null);
                            }}
                            onBlur={() => handleFinWeightSave(item)}
                            autoFocus
                            step="0.001"
                            className="w-full h-7 text-right font-mono text-xs border border-blue-300 rounded px-1 focus:outline-none focus:ring-1 focus:ring-blue-400"
                          />
                        </span>
                      ) : (
                        <span
                          className="text-gray-600 px-2 font-mono text-xs w-24 text-right cursor-pointer hover:bg-blue-50 rounded"
                          onClick={() => {
                            setFinWeightValue(item.weight || '');
                            setEditingFinWeight(item.id);
                          }}
                          title="Click to edit weight"
                        >
                          {item.weight > 0 ? formatWeight(item.weight) : '—'}
                        </span>
                      )}

                      {/* AMOUNT COLUMN */}
                      {item.isRms ? (
                        editingRms ? (
                          <span className="w-28 text-right px-1">
                            <input
                              type="number"
                              value={rmsValue}
                              onChange={(e) => setRmsValue(e.target.value)}
                              onKeyDown={async (e) => {
                                if (e.key === 'Enter') {
                                  setSavingRms(true);
                                  try {
                                    await updateRMSEntry(dateStr, parseFloat(rmsValue) || 0);
                                    await loadDashboard();
                                    toast.success('RMS amount saved');
                                  } catch (err) {
                                    toast.error('Failed to save RMS');
                                  }
                                  setSavingRms(false);
                                  setEditingRms(false);
                                } else if (e.key === 'Escape') {
                                  setEditingRms(false);
                                }
                              }}
                              onBlur={async () => {
                                setSavingRms(true);
                                try {
                                  await updateRMSEntry(dateStr, parseFloat(rmsValue) || 0);
                                  await loadDashboard();
                                  toast.success('RMS amount saved');
                                } catch (err) {
                                  toast.error('Failed to save RMS');
                                }
                                setSavingRms(false);
                                setEditingRms(false);
                              }}
                              autoFocus
                              step="1"
                              className="w-full h-7 text-right font-mono text-xs border border-blue-300 rounded px-1 focus:outline-none focus:ring-1 focus:ring-blue-400"
                            />
                          </span>
                        ) : (
                          <span
                            className="text-blue-600 px-2 font-mono text-right w-28 cursor-pointer hover:bg-blue-50 rounded"
                            onClick={() => {
                              setRmsValue(item.amount || '');
                              setEditingRms(true);
                            }}
                            title="Click to edit RMS amount"
                          >
                            {item.amount > 0 ? formatCurrency(item.amount) : <span className="text-gray-400 italic">enter ₹</span>}
                          </span>
                        )
                      ) : editingFinAmount === item.id ? (
                        <span className="w-28 text-right px-1">
                          <input
                            type="number"
                            value={finAmountValue}
                            onChange={(e) => setFinAmountValue(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleFinAmountSave(item);
                              if (e.key === 'Escape') setEditingFinAmount(null);
                            }}
                            onBlur={() => handleFinAmountSave(item)}
                            autoFocus
                            step="1"
                            className="w-full h-7 text-right font-mono text-xs border border-blue-300 rounded px-1 focus:outline-none focus:ring-1 focus:ring-blue-400"
                          />
                        </span>
                      ) : (
                        <span
                          className="text-gray-900 px-2 font-mono text-right w-28 cursor-pointer hover:bg-blue-50 rounded"
                          onClick={() => {
                            setFinAmountValue(item.amount || '');
                            setEditingFinAmount(item.id);
                          }}
                          title="Click to edit amount"
                        >
                          {item.amount > 0 ? formatCurrency(item.amount) : '₹0'}
                        </span>
                      )}

                      {/* REMOVE BUTTON */}
                      <span className="w-6 flex justify-center">
                        <button
                          onClick={() => handleRemoveFinEntry(item)}
                          className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 transition-opacity"
                          title="Remove entry"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </span>
                    </div>
                    {item.formula && (
                      <div className="px-2 pb-1.5 -mt-1">
                        <span className="text-[10px] text-blue-500 bg-blue-50 px-1.5 py-0.5 rounded font-mono">
                          ƒ {item.formula}
                        </span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </Card>

            {/* Grand Total Card */}
            <Card className="p-6 shadow-sm bg-gradient-to-br from-green-50 to-white border border-green-200">
              <div className="text-center space-y-3">
                <p className="text-sm font-semibold text-gray-600 uppercase tracking-wider">
                  Grand Total
                </p>
                <p className="text-4xl font-bold text-green-600">
                  {formatCurrency(calculateGrandTotal())}
                </p>
                <Button className="w-full mt-4 bg-blue-600 hover:bg-blue-700 text-white h-10">
                  Confirm
                </Button>
              </div>
            </Card>
          </div>
        </div>
      </div>

      {/* Add Entry Modal */}
      <Dialog open={addModalOpen} onOpenChange={setAddModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold">Add New Entry</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Entry Type</Label>
              <Select value={addEntryType} onValueChange={setAddEntryType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="totals">Totals Overview</SelectItem>
                  <SelectItem value="other">Other Calculation (Section F)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium">Name</Label>
              <Input
                value={addEntryData.name}
                onChange={(e) => setAddEntryData({ ...addEntryData, name: e.target.value })}
                placeholder="Enter name"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium">
                {addEntryType === 'other' ? 'Actual Weight (kg)' : 'Value'}
              </Label>
              <Input
                type="number"
                value={addEntryData.value}
                onChange={(e) => setAddEntryData({ ...addEntryData, value: e.target.value })}
                placeholder={addEntryType === 'other' ? 'Enter actual weight' : 'Enter value'}
                step="0.001"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                onClick={() => setAddModalOpen(false)}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={handleAddEntry}
                className="flex-1 bg-blue-600 hover:bg-blue-700"
                disabled={!addEntryData.name || !addEntryData.value}
              >
                Add Entry
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Formula Modal */}
      <Dialog open={addFormulaModalOpen} onOpenChange={setAddFormulaModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold">Add Formula Entry</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Name</Label>
              <Input
                value={formulaData.name}
                onChange={(e) => setFormulaData({ ...formulaData, name: e.target.value })}
                placeholder="Enter name"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium">Formula</Label>
              <Input
                value={formulaData.formula}
                onChange={(e) => setFormulaData({ ...formulaData, formula: e.target.value })}
                placeholder="e.g., ((PR-3) X W)"
                className="font-mono text-sm"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium">Calculated Value</Label>
              <Input
                type="number"
                value={formulaData.value}
                onChange={(e) => setFormulaData({ ...formulaData, value: e.target.value })}
                placeholder="Enter value"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                onClick={() => setAddFormulaModalOpen(false)}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={handleAddFormula}
                className="flex-1 bg-blue-600 hover:bg-blue-700"
                disabled={!formulaData.name || !formulaData.value}
              >
                Add Formula
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SupplierDashboardPage;
