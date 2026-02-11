import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';

export const AddEntryModal = ({ isOpen, onClose, onSave, suppliers }) => {
  const [formData, setFormData] = useState({
    type: 'supplier',
    supplierId: '',
    party: '',
    a: '',
    b: '',
    c: '',
    name: '',
    value: '',
    amount: ''
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(formData);
    setFormData({
      type: 'supplier',
      supplierId: '',
      party: '',
      a: '',
      b: '',
      c: '',
      name: '',
      value: '',
      amount: ''
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl font-heading font-bold uppercase tracking-wide">
            Add New Entry
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          {/* Entry Type */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold uppercase tracking-wider">Entry Type</Label>
            <Select
              value={formData.type}
              onValueChange={(value) => setFormData({ ...formData, type: value })}
            >
              <SelectTrigger className="focus-ring">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="supplier">Supplier Entry</SelectItem>
                <SelectItem value="other">Other Calculation</SelectItem>
                <SelectItem value="financial">Financial Entry</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Supplier Entry Fields */}
          {formData.type === 'supplier' && (
            <>
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wider">Supplier</Label>
                <Select
                  value={formData.supplierId}
                  onValueChange={(value) => setFormData({ ...formData, supplierId: value })}
                >
                  <SelectTrigger className="focus-ring">
                    <SelectValue placeholder="Select supplier" />
                  </SelectTrigger>
                  <SelectContent>
                    {suppliers.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wider">Party Name</Label>
                <Input
                  value={formData.party}
                  onChange={(e) => setFormData({ ...formData, party: e.target.value })}
                  className="focus-ring"
                  required
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-2">
                  <Label className="text-xs font-semibold uppercase tracking-wider">A</Label>
                  <Input
                    type="number"
                    step="0.001"
                    value={formData.a}
                    onChange={(e) => setFormData({ ...formData, a: e.target.value })}
                    className="focus-ring"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-semibold uppercase tracking-wider">B</Label>
                  <Input
                    type="number"
                    step="0.001"
                    value={formData.b}
                    onChange={(e) => setFormData({ ...formData, b: e.target.value })}
                    className="focus-ring"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-semibold uppercase tracking-wider">C</Label>
                  <Input
                    type="number"
                    step="0.001"
                    value={formData.c}
                    onChange={(e) => setFormData({ ...formData, c: e.target.value })}
                    className="focus-ring"
                    required
                  />
                </div>
              </div>
            </>
          )}

          {/* Other Calculation Fields */}
          {formData.type === 'other' && (
            <>
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wider">Item Name</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="focus-ring"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wider">Value</Label>
                <Input
                  type="number"
                  step="0.001"
                  value={formData.value}
                  onChange={(e) => setFormData({ ...formData, value: e.target.value })}
                  className="focus-ring"
                  required
                />
              </div>
            </>
          )}

          {/* Financial Entry Fields */}
          {formData.type === 'financial' && (
            <>
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wider">Name</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="focus-ring"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wider">Amount (₹)</Label>
                <Input
                  type="number"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  className="focus-ring"
                  required
                />
              </div>
            </>
          )}

          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" className="bg-primary hover:bg-primary-hover">
              Add Entry
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
