import React, { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { Card } from './ui/card';
import { Button } from './ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from './ui/table';
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

// Helper to safely format time from createdAt
const formatTime = (createdAt) => {
  if (!createdAt) return '--:--';
  try {
    const date = new Date(createdAt);
    if (isNaN(date.getTime())) return '--:--';
    return date.toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  } catch (e) {
    return '--:--';
  }
};

export const EntriesTable = ({ entries, selectedDate, onEditEntry, onDeleteEntry }) => {
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  if (!entries || entries.length === 0) {
    return (
      <Card className="p-8">
        <div className="text-center space-y-2">
          <h3 className="text-sm font-heading font-bold uppercase tracking-wider text-foreground">
            Today's Entries
          </h3>
          <p className="text-muted-foreground">
            No entries for {selectedDate}
          </p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <h3 className="text-sm font-heading font-bold uppercase tracking-wider mb-4 text-foreground">
        Today's Entries
      </h3>
      <div className="rounded-lg border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted">
              <TableHead className="font-bold">Party</TableHead>
              <TableHead className="font-bold">Load Weight</TableHead>
              <TableHead className="font-bold">Empty Weight</TableHead>
              <TableHead className="font-bold">Live Weight</TableHead>
              <TableHead className="font-bold">Time</TableHead>
              <TableHead className="font-bold text-center w-10">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {entries.map((entry) => (
              <TableRow
                key={entry.id}
                onClick={() => onEditEntry && onEditEntry(entry)}
                className={`cursor-pointer transition-colors ${
                  entry.liveWeight > 0 
                    ? 'bg-green-50 hover:bg-green-100 dark:bg-green-950/30 dark:hover:bg-green-900/40' 
                    : 'hover:bg-muted/50'
                }`}
                title="Click to edit"
              >
                <TableCell className="font-medium">{entry.partyName}</TableCell>
                <TableCell className="weight-display">
                  {formatWeight(entry.loadWeight)} kg
                </TableCell>
                <TableCell className="weight-display">
                  {formatWeight(entry.emptyWeight)} kg
                </TableCell>
                <TableCell className={`weight-display font-semibold ${
                  entry.liveWeight > 0 ? 'text-green-600 dark:text-green-400' : 'text-success'
                }`}>
                  {formatWeight(entry.liveWeight)} kg
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {formatTime(entry.createdAt)}
                </TableCell>
                <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                  <AlertDialog open={deleteConfirm === entry.id} onOpenChange={(open) => {
                    if (!open) setDeleteConfirm(null);
                  }}>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteConfirm(entry.id);
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete Entry</AlertDialogTitle>
                        <AlertDialogDescription>
                          Are you sure you want to delete this entry for {entry.partyName}? This action cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => {
                            onDeleteEntry(entry.id);
                            setDeleteConfirm(null);
                          }}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </TableCell>
              </TableRow>
          ))}
          </TableBody>
        </Table>
      </div>
    </Card>
  );
};
