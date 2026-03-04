import React from 'react';
import { useNavigate } from 'react-router-dom';
import { User } from 'lucide-react';
import { Card } from './ui/card';
import { Badge } from './ui/badge';

export const SupplierCard = ({ supplier, isAddNew = false, onAddNew }) => {
  const navigate = useNavigate();

  const handleClick = () => {
    if (!isAddNew) {
      navigate(`/supplier/${supplier.id}`);
    } else if (onAddNew) {
      onAddNew();
    }
  };

  if (isAddNew) {
    return (
      <Card
        className="p-8 cursor-pointer border-2 border-dashed border-border hover:border-primary hover:bg-accent/50 transition-all duration-300 card-elevated"
        onClick={handleClick}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && handleClick()}
        aria-label="Add new supplier"
      >
        <div className="flex flex-col items-center justify-center space-y-4 py-4">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
            <span className="text-4xl font-light text-primary">+</span>
          </div>
          <p className="text-sm font-heading font-bold uppercase tracking-wider text-foreground">
            Add New Supplier
          </p>
        </div>
      </Card>
    );
  }

  return (
    <Card
      className="p-6 cursor-pointer hover:bg-accent/50 transition-all duration-300 card-elevated group"
      onClick={handleClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && handleClick()}
      aria-label={`View ${supplier.name}`}
    >
      <div className="flex items-center space-x-4">
        {/* Icon */}
        <div className="w-14 h-14 rounded-full bg-primary/10 group-hover:bg-primary/20 flex items-center justify-center transition-colors duration-300">
          <User className="w-7 h-7 text-primary" />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-heading font-bold uppercase tracking-wide text-foreground truncate">
            {supplier.name}
          </h3>
          <Badge variant="outline" className="mt-2 uppercase text-xs">
            {supplier.productType}
          </Badge>
        </div>
      </div>
    </Card>
  );
};
