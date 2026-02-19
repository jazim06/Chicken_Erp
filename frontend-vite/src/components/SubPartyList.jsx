import React, { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from './ui/alert-dialog';
import { formatWeight } from '../utils/apiAdapter';

export const SubPartyList = ({ subParties, allSubParties, entries, onAddEntry, onAddSubParty, onDeleteSubParty, selectedDate }) => {
  const [isAdding, setIsAdding] = useState(false);
  const [newPartyName, setNewPartyName] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  const handleAddNew = () => {
    if (newPartyName.trim()) {
      onAddSubParty(newPartyName.trim());
      setNewPartyName('');
      setIsAdding(false);
    }
  };

  const handleDelete = (partyId) => {
    onDeleteSubParty(partyId);
    setDeleteConfirm(null);
  };

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-heading font-bold uppercase tracking-wider text-foreground">
            Sub-Parties
          </h3>
          {entries.length > 0 && (
        <p className="text-xs text-muted-foreground mt-1">
              {entries.length} entr{entries.length === 1 ? 'y' : 'ies'}
            </p>
          )}
        </div>
        <Button
          size="sm"
          variant="outline"
          className="h-8 gap-2"
          onClick={() => setIsAdding(true)}
        >
          <Plus className="h-4 w-4" />
          Add Party
        </Button>
      </div>

      <div className="space-y-2">
        {/* Show message if no entries today */}
        {subParties.length === 0 && !isAdding && (
          <div className="p-3 rounded-lg bg-muted/50 border border-dashed text-center">
            <p className="text-sm text-muted-foreground">No entries yet for today</p>
          </div>
        )}

        {/* Sub-parties with entries today */}
        <div className="space-y-2">
          {subParties.map((party, index) => {
            const entryForParty = entries.find(e => e.partyName === party.name);
            const hasWeight = entryForParty && entryForParty.liveWeight > 0;

            return (
              <div
                key={party.id}
                className={`p-3 rounded-lg border-2 transition-all ${
                  hasWeight
                    ? 'border-green-400 bg-green-50 dark:bg-green-950/20'
                    : 'border-border bg-card hover:bg-muted/50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className={`font-medium text-sm truncate ${
                      hasWeight ? 'text-green-700 dark:text-green-300' : ''
                    }`}>
                      {party.name}
                    </p>
                    {entryForParty && (
                      <p className={`text-xs ${
                        hasWeight
                          ? 'text-green-600 dark:text-green-400 font-semibold'
                          : 'text-muted-foreground'
                      }`}>
                        {hasWeight ? `✓ ${formatWeight(entryForParty.liveWeight)} kg` : 'No weight entered'}
                      </p>
                    )}
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-shrink-0 h-8 w-8 p-0"
                    onClick={() => onAddEntry(party)}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                  <AlertDialog open={deleteConfirm === party.id} onOpenChange={(open) => {
                    if (!open) setDeleteConfirm(null);
                  }}>
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-shrink-0 h-8 w-8 p-0 text-destructive hover:text-destructive"
                      onClick={() => setDeleteConfirm(party.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete Sub-Party</AlertDialogTitle>
                        <AlertDialogDescription>
                          Are you sure you want to delete {party.name}? This action cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => handleDelete(party.id)}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            );
          })}
        </div>

        {/* Add New Party Input */}
        {isAdding && (
          <div className="flex gap-2 p-3 rounded-lg bg-accent/30 border border-primary/30">
            <Input
              placeholder="Enter party name (adds to all suppliers)"
              value={newPartyName}
              onChange={(e) => setNewPartyName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAddNew();
                if (e.key === 'Escape') {
                  setIsAdding(false);
                  setNewPartyName('');
                }
              }}
              className="flex-1 h-9"
              autoFocus
            />
            <Button
              size="sm"
              onClick={handleAddNew}
              className="bg-primary hover:bg-primary-hover"
              disabled={!newPartyName.trim()}
            >
              Add
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setIsAdding(false);
                setNewPartyName('');
              }}
            >
              Cancel
            </Button>
          </div>
        )}
      </div>
    </Card>
  );
};
