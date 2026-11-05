import type { ReactNode } from 'react';
import { Text } from '@foundathyon/community-ui';

/** Small heading of a block inside the MCP dialogs. */
export function SectionTitle({ children }: { children: ReactNode }) {
  return <Text variant="overline" tone="muted" as="p">{children}</Text>;
}
