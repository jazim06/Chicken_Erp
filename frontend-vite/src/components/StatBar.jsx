import React from 'react';
import { Card } from './ui/card';
import { formatWeight } from '../utils/apiAdapter';

export const StatBar = ({ todayEntries, totalWeight, activeParties }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {/* Today's Entries */}
      <Card className="stat-bar-gradient p-6 border-0 text-background">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider opacity-90">
            Today's Entries
          </p>
          <p className="text-4xl font-heading font-bold weight-display">
            {todayEntries}
          </p>
        </div>
      </Card>

      {/* Total Live Weight */}
      <Card className="stat-bar-gradient p-6 border-0 text-background">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider opacity-90">
            Total Live Weight
          </p>
          <p className="text-4xl font-heading font-bold weight-display">
            {formatWeight(totalWeight)} kg
          </p>
        </div>
      </Card>

      {/* Parties Active */}
      <Card className="stat-bar-gradient p-6 border-0 text-background">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider opacity-90">
            Parties Active
          </p>
          <p className="text-4xl font-heading font-bold">
            {activeParties}
          </p>
        </div>
      </Card>
    </div>
  );
};
