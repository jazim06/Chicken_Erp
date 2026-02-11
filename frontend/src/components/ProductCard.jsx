import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from './ui/card';

export const ProductCard = ({ product }) => {
  const navigate = useNavigate();

  const handleClick = () => {
    navigate(`/suppliers?product=${product.id}`);
  };

  return (
    <Card
      className="relative overflow-hidden cursor-pointer group h-80 border-0 card-elevated hover-lift"
      onClick={handleClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && handleClick()}
      aria-label={`Select ${product.name}`}
    >
      {/* Background Image with Overlay */}
      <div className="absolute inset-0">
        <img
          src={product.image}
          alt={product.name}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-foreground/90 via-foreground/60 to-foreground/40 group-hover:from-primary/80 group-hover:via-primary/50 group-hover:to-primary/30 transition-all duration-500" />
      </div>

      {/* Content */}
      <div className="relative h-full flex flex-col items-center justify-center p-8 text-center">
        <div className="space-y-4">
          {/* Icon based on product type */}
          <div className="mx-auto w-20 h-20 rounded-full bg-background/20 backdrop-blur-sm flex items-center justify-center group-hover:bg-background/30 transition-colors duration-300">
            {product.id === 'chicken' ? (
              <svg className="w-10 h-10 text-background" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2C10.34 2 9 3.34 9 5c0 1.1.6 2.05 1.5 2.58V9H9v2h1.5v2.5c-1.66 0-3 1.34-3 3V19h9v-2.5c0-1.66-1.34-3-3-3V11H15V9h-1.5V7.58C14.4 7.05 15 6.1 15 5c0-1.66-1.34-3-3-3z"/>
              </svg>
            ) : (
              <svg className="w-10 h-10 text-background" fill="currentColor" viewBox="0 0 24 24">
                <path d="M19 17c0-2.21-1.79-4-4-4s-4 1.79-4 4-1.79 4-4 4H5c0-2.76 2.24-5 5-5 1.38 0 2.63.56 3.54 1.46C14.44 16.56 15.69 16 17.07 16c2.76 0 5 2.24 5 5h-2c0-1.66-1.34-3-3-3s-3 1.34-3 3H8c0-1.1.9-2 2-2s2-.9 2-2 .9-2 2-2 2 .9 2 2h2z"/>
              </svg>
            )}
          </div>

          <h2 className="text-4xl font-heading font-bold text-background tracking-wider">
            {product.name}
          </h2>
        </div>
      </div>
    </Card>
  );
};
