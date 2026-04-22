import React from 'react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const SmokeOverlay = () => (
  <div className="smoke-container">
    <div className="smoke-particle" />
    <div className="smoke-particle" />
    <div className="smoke-particle" />
    <div className="smoke-particle" />
    <div className="smoke-particle" />
  </div>
);
