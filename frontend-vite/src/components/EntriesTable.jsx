import React from 'react';
import { Card } from './ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from './ui/table';
import { formatWeight } from '../utils/apiAdapter';

export const EntriesTable = ({ entries, selectedDate, onEditEntry }) => {
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
            </TableRow>
          </TableHeader>
          <TableBody>
            {entries.map((entry) => (
              <TableRow
                key={entry.id}
                onClick={() => onEditEntry && onEditEntry(entry)}
                className="cursor-pointer hover:bg-muted/50 transition-colors"
                title="Click to edit"
              >
                <TableCell className="font-medium">{entry.partyName}</TableCell>
                <TableCell className="weight-display">
                  {formatWeight(entry.loadWeight)} kg
                </TableCell>
                <TableCell className="weight-display">
                  {formatWeight(entry.emptyWeight)} kg
                </TableCell>
                <TableCell className="weight-display font-semibold text-success">
                  {formatWeight(entry.liveWeight)} kg
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {new Date(entry.createdAt).toLocaleTimeString('en-IN', {
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </Card>
  );
};
