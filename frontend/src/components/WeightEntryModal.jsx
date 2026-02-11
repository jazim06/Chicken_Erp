import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { formatWeight } from '../utils/apiAdapter';

export const WeightEntryModal = ({ isOpen, onClose, party, onSave }) => {
  const [loadWeight, setLoadWeight] = useState('');
  const [emptyWeight, setEmptyWeight] = useState('');
  const [liveWeight, setLiveWeight] = useState(0);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = parseFloat(loadWeight) || 0;
    const empty = parseFloat(emptyWeight) || 0;
    const live = load - empty;

    if (load > 0 && empty > 0) {
      if (load <= empty) {
        setError('Load weight must be greater than empty weight');
        setLiveWeight(0);
      } else {
        setError('');
        setLiveWeight(live);
      }
    } else {
      setError('');
      setLiveWeight(0);
    }
  }, [loadWeight, emptyWeight]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (liveWeight > 0 && !error) {
      onSave({
        loadWeight: parseFloat(loadWeight),
        emptyWeight: parseFloat(emptyWeight),
        liveWeight
      });
      handleClose();
    }
  };

  const handleClose = () => {
    setLoadWeight('');
    setEmptyWeight('');
    setLiveWeight(0);
    setError('');
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl font-heading font-bold uppercase tracking-wide">
            Weight Entry - {party?.name}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6 mt-4">
          {/* Load Weight */}
          <div className="space-y-2">
            <Label htmlFor="loadWeight" className="text-xs font-semibold uppercase tracking-wider">
              Load Weight (KG)
            </Label>
            <Input
              id="loadWeight"
              type="number"
              step="0.001"
              placeholder="Enter load weight"
              value={loadWeight}
              onChange={(e) => setLoadWeight(e.target.value)}
              className="h-12 text-lg weight-display focus-ring"
              required
            />
          </div>

          {/* Empty Weight */}
          <div className="space-y-2">
            <Label htmlFor="emptyWeight" className="text-xs font-semibold uppercase tracking-wider">
              Empty Weight (KG)
            </Label>
            <Input
              id="emptyWeight"
              type="number"
              step="0.001"
              placeholder="Enter empty weight"
              value={emptyWeight}
              onChange={(e) => setEmptyWeight(e.target.value)}
              className="h-12 text-lg weight-display focus-ring"
              required
            />
          </div>

          {/* Error Message */}
          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}

          {/* Live Weight Display */}
          <div className="p-6 rounded-lg bg-success/10 border-2 border-success/30">
            <p className="text-xs font-semibold uppercase tracking-wider text-success mb-2">
              Live Weight
            </p>
            <p className="text-4xl font-heading font-bold text-success weight-display">
              {formatWeight(liveWeight)} kg
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              className="flex-1 h-12"
              onClick={handleClose}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="flex-1 h-12 bg-primary hover:bg-primary-hover"
              disabled={!liveWeight || !!error}
            >
              Save Entry
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
