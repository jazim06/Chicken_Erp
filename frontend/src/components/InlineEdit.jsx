import React, { useState, useEffect, useRef } from 'react';
import { Input } from './ui/input';
import { cn } from '../lib/utils';

export const InlineEdit = ({ value, onSave, type = 'number', decimals = 3, className }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);
  const inputRef = useRef(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  useEffect(() => {
    setEditValue(value);
  }, [value]);

  const handleSave = () => {
    if (editValue !== value) {
      onSave(editValue);
    }
    setIsEditing(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleSave();
    } else if (e.key === 'Escape') {
      setEditValue(value);
      setIsEditing(false);
    }
  };

  const formatDisplay = (val) => {
    if (type === 'number') {
      return typeof val === 'number' ? val.toFixed(decimals) : val;
    }
    return val;
  };

  if (isEditing) {
    return (
      <Input
        ref={inputRef}
        type={type === 'number' ? 'number' : 'text'}
        value={editValue}
        onChange={(e) => setEditValue(type === 'number' ? parseFloat(e.target.value) || 0 : e.target.value)}
        onBlur={handleSave}
        onKeyDown={handleKeyDown}
        step={type === 'number' ? '0.001' : undefined}
        className={cn('h-8 text-sm weight-display', className)}
      />
    );
  }

  return (
    <div
      onClick={() => setIsEditing(true)}
      className={cn(
        'cursor-pointer hover:bg-accent/30 px-2 py-1 rounded transition-colors duration-200 weight-display',
        className
      )}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && setIsEditing(true)}
    >
      {formatDisplay(value)}
    </div>
  );
};
