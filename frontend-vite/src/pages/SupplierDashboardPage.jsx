import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Plus, Save, Download, X, ChevronLeft, ChevronRight, Calendar as CalendarIcon } from 'lucide-react';
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
  const [deductionModalOpen, setDeductionModalOpen] = useState(false);
  const [editingCell, setEditingCell] = useState(null);
  const [editValue, setEditValue] = useState('');

  // Add entry form state
  const [addEntryType, setAddEntryType] = useState('totals');
  const [addEntryData, setAddEntryData] = useState({ name: '', value: '' });

  // Add formula form state
  const [formulaData, setFormulaData] = useState({ name: '', formula: '', value: '' });

  // Deduction form state
  const [deductionData, setDeductionData] = useState({ partyName: '', amount: '' });

  // Hardcoded deduction party list
  const DEDUCTION_PARTIES = [
    'Thamim', 'Irfan', 'Rajendran', 'BBC', 'Parveen',
    'Masthan', 'AL Ayaan', 'MBB', 'F', 'Anas'
  ];

  const dateStr = format(selectedDate, 'yyyy-MM-dd');

  useEffect(() => {
    loadDashboard();
  }, [id, dateStr]);

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

  const handleAddDeduction = async () => {
    try {
      await createDeductionEntry({
        partyName: deductionData.partyName,
        supplierId: '',
        supplierName: '',
        amount: parseFloat(deductionData.amount) || 0,
        date: dateStr,
      });
      await loadDashboard();
      setDeductionModalOpen(false);
      setDeductionData({ partyName: '', amount: '' });
      toast.success('Deduction added successfully');
    } catch (error) {
      toast.error('Failed to add deduction');
    }
  };

  const handleDeleteDeduction = async (deductionId) => {
    try {
      await deleteDeductionEntry(deductionId);
      await loadDashboard();
      toast.success('Deduction removed');
    } catch (error) {
      toast.error('Failed to remove deduction');
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
    return dashboardData?.financialTotal || 0;
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
              onClick={() => navigate(`/supplier/${id}`)}
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
            <div className="text-sm text-gray-600">
              PR Rate: <span className="font-semibold">{dashboardData?.effectivePrRate || 177}</span>
            </div>
            <Button
              onClick={() => setAddModalOpen(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white h-9 px-4 text-sm"
            >
              <Plus className="h-4 w-4 mr-1" />
              Add New
            </Button>
            <Button
              onClick={handleSave}
              variant="outline"
              className="h-9 px-4 text-sm"
            >
              <Save className="h-4 w-4 mr-1" />
              Save
            </Button>
            <Button
              onClick={handleExport}
              variant="outline"
              className="h-9 px-4 text-sm"
            >
              <Download className="h-4 w-4 mr-1" />
              Export
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
                    className="flex items-center justify-between py-2 border-b border-gray-100 text-sm"
                  >
                    <span className="px-2 text-gray-900">{item.party}</span>
                    <span className="font-mono px-2 text-gray-900">{formatWeight(item.total)}</span>
                  </div>
                ))}
                <div className="flex items-center justify-between py-3 bg-blue-50 font-bold text-sm rounded mt-2">
                  <span className="px-2 text-blue-600 uppercase text-xs tracking-wider">Subtotal</span>
                  <span className="font-mono px-2 text-blue-600">{formatWeight(dashboardData?.subtotal || 0)}</span>
                </div>
              </div>

              {/* Deductions Section */}
              <div className="mt-4 pt-3 border-t border-gray-200">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xs font-semibold text-red-600 uppercase tracking-wider">Deductions</h3>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setDeductionModalOpen(true)}
                    className="h-7 px-2 text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    Add
                  </Button>
                </div>
                {(dashboardData?.deductions || []).length === 0 ? (
                  <p className="text-xs text-gray-400 italic px-2 py-1">No deductions added</p>
                ) : (
                  <div className="space-y-0.5">
                    {(dashboardData?.deductions || []).map((ded) => (
                      <div
                        key={ded.id}
                        className="flex items-center justify-between py-1.5 border-b border-gray-100 text-sm group"
                      >
                        <div className="flex items-center gap-2 px-2">
                          <span className="text-red-600">{ded.partyName}</span>
                          <span className="text-xs text-gray-400">({ded.supplierName})</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-red-600 px-2">-{formatWeight(ded.amount)}</span>
                          <button
                            onClick={() => handleDeleteDeduction(ded.id)}
                            className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 transition-opacity"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                    ))}
                    <div className="flex items-center justify-between py-2 bg-red-50 font-bold text-sm rounded mt-1">
                      <span className="px-2 text-red-600 uppercase text-xs tracking-wider">Total Deductions</span>
                      <span className="font-mono px-2 text-red-600">-{formatWeight(dashboardData?.totalDeductions || 0)}</span>
                    </div>
                  </div>
                )}
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
          </div>

          {/* RIGHT COLUMN */}
          <div className="space-y-6">
            <Card className="p-4 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wider">Financial Breakdown</h2>
              </div>
              <div className="space-y-0.5">
                <div className="flex items-center justify-between py-2 border-b border-gray-200 font-semibold text-xs text-gray-600">
                  <span>NAME</span>
                  <span className="text-right">WEIGHT</span>
                  <span className="text-right">AMOUNT (₹)</span>
                </div>
                {(() => {
                  // Group financial entries by supplier
                  const grouped = {};
                  (dashboardData?.financial || []).forEach(item => {
                    const key = item.supplierName || 'Other';
                    if (!grouped[key]) grouped[key] = [];
                    grouped[key].push(item);
                  });
                  return Object.entries(grouped).map(([supplierName, items]) => (
                    <div key={supplierName}>
                      <div className="py-1.5 px-2 text-xs font-bold text-gray-500 uppercase tracking-wider bg-gray-50 mt-1">
                        {supplierName}
                      </div>
                      {items.map(item => (
                        <div key={item.id} className="border-b border-gray-100 hover:bg-gray-50">
                          <div className="flex items-center justify-between py-2 text-sm">
                            <span className="text-gray-900 px-2 flex-1">{item.name}</span>
                            <span className="text-gray-600 px-2 font-mono text-xs w-20 text-right">
                              {formatWeight(item.weight)}
                            </span>
                            <span className="text-gray-900 px-2 font-mono text-right w-24">
                              {formatCurrency(item.amount)}
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
                  ));
                })()}
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

      {/* Deduction Modal */}
      <Dialog open={deductionModalOpen} onOpenChange={setDeductionModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold">Add Deduction</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Select Party</Label>
              <Select
                value={deductionData.partyName || ''}
                onValueChange={(val) => {
                  setDeductionData({
                    ...deductionData,
                    partyName: val,
                  });
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choose a party" />
                </SelectTrigger>
                <SelectContent>
                  {DEDUCTION_PARTIES.map(party => (
                    <SelectItem key={party} value={party}>
                      {party}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium">Deduction Amount (kg)</Label>
              <Input
                type="number"
                value={deductionData.amount}
                onChange={(e) => setDeductionData({ ...deductionData, amount: e.target.value })}
                placeholder="Enter deduction weight"
                step="0.001"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                onClick={() => setDeductionModalOpen(false)}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={handleAddDeduction}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                disabled={!deductionData.partyName || !deductionData.amount}
              >
                Add Deduction
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SupplierDashboardPage;
