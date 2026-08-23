'use client';

import { HelpCircle } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface FieldHintProps {
  text: string;
  href?: string;
  linkLabel?: string;
  className?: string;
  side?: 'top' | 'right' | 'bottom' | 'left';
}

export function FieldHint({ text, href, linkLabel, className, side = 'top' }: FieldHintProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label="More info"
          className={cn(
            'inline-flex items-center justify-center text-muted-foreground/70 hover:text-text transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-[var(--fdn-focus)] rounded',
            className
          )}
        >
          <HelpCircle className="w-3.5 h-3.5" />
        </button>
      </TooltipTrigger>
      <TooltipContent side={side} className="max-w-xs whitespace-normal text-xs leading-relaxed py-2">
        <p>{text}</p>
        {href && (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1.5 inline-block underline text-accent hover:text-accent"
          >
            {linkLabel || 'Learn more →'}
          </a>
        )}
      </TooltipContent>
    </Tooltip>
  );
}
