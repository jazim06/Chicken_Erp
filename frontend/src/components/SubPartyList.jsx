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

export const SubPartyList = ({ subParties, onAddEntry, onAddSubParty, onDeleteSubParty }) => {
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
        <h3 className="text-sm font-heading font-bold uppercase tracking-wider text-foreground">
          Sub-Parties
        </h3>
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

      <div className="space-y-3">
        {/* Add New Party Input */}
        {isAdding && (
          <div className="flex gap-2 p-3 rounded-lg bg-accent/30 border border-primary/30">
            <Input
              placeholder="Enter party name"
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

        {/* Existing Parties */}
        {subParties.map((party) => (
          <div
            key={party.id}
            className="flex items-center justify-between p-4 rounded-lg bg-accent/50 hover:bg-accent transition-colors duration-200 group"
          >
            <div className="flex-1">
              <p className="font-semibold text-foreground">{party.name}</p>
              <p className="text-sm text-muted-foreground weight-display">
                Today: {formatWeight(party.todayWeight)} kg
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                className="h-10 w-10 rounded-full bg-primary hover:bg-primary-hover p-0"
                onClick={() => onAddEntry(party)}
                aria-label={`Add entry for ${party.name}`}
              >
                <Plus className="h-5 w-5" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-10 w-10 rounded-full p-0 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive/10 hover:text-destructive"
                onClick={() => setDeleteConfirm(party)}
                aria-label={`Delete ${party.name}`}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Sub-Party</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deleteConfirm?.name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => handleDelete(deleteConfirm?.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
};
