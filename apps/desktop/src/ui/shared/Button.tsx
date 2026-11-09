import type { ButtonHTMLAttributes, ReactNode } from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';

const VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-accent text-on-accent hover:bg-accent-hover',
  secondary: 'border border-border bg-surface text-text hover:bg-surface-hover',
  danger: 'border border-danger text-danger hover:bg-surface-hover',
  ghost: 'text-text hover:bg-surface-hover',
};

export function Button(
  props: ButtonHTMLAttributes<HTMLButtonElement> & { readonly variant?: ButtonVariant },
): ReactNode {
  const { variant = 'secondary', className = '', type = 'button', ...rest } = props;
  return (
    <button
      type={type}
      className={`inline-flex items-center justify-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50 ${VARIANTS[variant]} ${className}`}
      {...rest}
    />
  );
}
