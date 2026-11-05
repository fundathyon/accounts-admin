'use client';

/*
 * Buttons of the admin: community-ui's with the metrics of the Foundathyon
 * admin (xs 20 · sm 22 · md 26 · lg 30). Always import from here, never
 * Button/IconButton/buttonVariants from community-ui directly: this layer sets
 * the default size (sm) and adds the .fdn-btn-* / .fdn-icon-btn-* classes from
 * globals.css, which override the library's 24/28/32/36 scale.
 */
import { forwardRef } from 'react';
import {
  Button as BaseButton,
  IconButton as BaseIconButton,
  buttonVariants as baseButtonVariants,
  type ButtonProps,
  type IconButtonProps,
} from '@foundathyon/community-ui';
import { cn } from '@/lib/utils';

type Size = 'xs' | 'sm' | 'md' | 'lg';

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { size = 'sm', className, ...props },
  ref,
) {
  return <BaseButton ref={ref} size={size} className={cn(`fdn-btn-${size}`, className)} {...props} />;
});

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { size = 'sm', className, ...props },
  ref,
) {
  return <BaseIconButton ref={ref} size={size} className={cn(`fdn-icon-btn-${size}`, className)} {...props} />;
});

/** For a Link that looks like a button (actions that navigate are links). */
export function buttonVariants(
  options: { variant?: ButtonProps['variant']; size?: Size | null; className?: string } = {},
) {
  const size = options.size ?? 'sm';
  return cn(baseButtonVariants({ variant: options.variant, size }), `fdn-btn-${size}`, options.className);
}

export type { ButtonProps, IconButtonProps };
