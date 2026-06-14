/**
 * Button Component
 * Reusable button with consistent styling
 */

import React, { useState } from 'react';
import { COLORS } from '@/constants/theme';

export type ButtonVariant = 'primary' | 'danger' | 'secondary';
export type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  children: React.ReactNode;
}

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2 text-base',
  lg: 'px-6 py-3 text-lg',
};

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  children,
  className = '',
  ...props
}) => {
  const [isHovered, setIsHovered] = useState(false);

  const getVariantStyles = (): React.CSSProperties => {
    switch (variant) {
      case 'primary':
        return {
          backgroundColor: isHovered ? COLORS.primaryHover : COLORS.primary,
          color: COLORS.onGold,
          border: '1px solid transparent',
        };
      case 'danger':
        return {
          backgroundColor: isHovered ? COLORS.dangerHover : COLORS.danger,
          color: COLORS.dangerText,
          border: '1px solid transparent',
        };
      case 'secondary':
        return {
          backgroundColor: isHovered ? COLORS.goldSoft : COLORS.surfaceWhite,
          color: COLORS.goldChipText,
          border: `1px solid ${COLORS.goldBorderStrong}`,
        };
    }
  };

  const baseClasses = 'rounded-lg font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed';
  const sizeClasses = SIZE_CLASSES[size];
  const widthClass = fullWidth ? 'w-full' : '';

  return (
    <button
      className={`${baseClasses} ${sizeClasses} ${widthClass} ${className}`}
      style={getVariantStyles()}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      {...props}
    >
      {children}
    </button>
  );
};
