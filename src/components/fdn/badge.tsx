/*
 * Badges of the admin: community-ui's with the Foundathyon admin metrics (22px,
 * radius 6, 12/16 medium text). Always import from here, never from
 * community-ui directly. Pick the tone by meaning, not by colour.
 */
import {
  Badge as BaseBadge,
  StatusBadge as BaseStatusBadge,
  type BadgeProps,
  type StatusBadgeProps,
} from '@foundathyon/community-ui';
import { cn } from '@/lib/utils';

export function Badge({ className, ...props }: BadgeProps) {
  return <BaseBadge className={cn('fdn-badge', className)} {...props} />;
}

export function StatusBadge({ className, ...props }: StatusBadgeProps) {
  return <BaseStatusBadge className={cn('fdn-badge', className)} {...props} />;
}

export type { BadgeProps, StatusBadgeProps };
