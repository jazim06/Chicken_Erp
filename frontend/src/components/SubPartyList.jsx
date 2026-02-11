import React from 'react';
import { Plus } from 'lucide-react';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { formatWeight } from '../utils/apiAdapter';

export const SubPartyList = ({ subParties, onAddEntry }) => {
  return (
    <Card className="p-6">
      <h3 className="text-sm font-heading font-bold uppercase tracking-wider mb-4 text-foreground">
        Sub-Parties
      </h3>
      <div className="space-y-3">
        {subParties.map((party) => (
          <div
            key={party.id}
            className="flex items-center justify-between p-4 rounded-lg bg-accent/50 hover:bg-accent transition-colors duration-200"
          >
            <div className="flex-1">
              <p className="font-semibold text-foreground">{party.name}</p>
              <p className="text-sm text-muted-foreground weight-display">
                Today: {formatWeight(party.todayWeight)} kg
              </p>
            </div>
            <Button
              size="sm"
              className="h-10 w-10 rounded-full bg-primary hover:bg-primary-hover p-0"
              onClick={() => onAddEntry(party)}
              aria-label={`Add entry for ${party.name}`}
            >
              <Plus className="h-5 w-5" />
            </Button>
          </div>
        ))}
      </div>
    </Card>
  );
};
