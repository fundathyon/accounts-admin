'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { useTheme } from 'next-themes';
import type { Extension } from '@codemirror/state';

const CodeMirror = dynamic(
  () => import('@uiw/react-codemirror').then((mod) => mod.default),
  { ssr: false }
);

interface JsonEditorProps {
  value: string;
  onChange: (value: string) => void;
  minHeight?: string;
  maxHeight?: string;
  className?: string;
}

export function JsonEditor({
  value,
  onChange,
  minHeight = '200px',
  maxHeight = '70vh',
  className = '',
}: JsonEditorProps) {
  const { resolvedTheme } = useTheme();
  const [extensions, setExtensions] = useState<Extension[]>([]);

  useEffect(() => {
    import('@codemirror/lang-json').then(({ json }) => setExtensions([json()]));
  }, []);

  return (
    <div
      className={`overflow-hidden rounded-xl border border-input [&_.cm-editor]:outline-none [&_.cm-editor]:ring-0 [&_.cm-focused]:ring-2 [&_.cm-focused]:ring-[var(--fdn-focus)] [&_.cm-scroller]:overflow-auto ${className}`}
      style={{ minHeight, maxHeight }}
    >
      <CodeMirror
        value={value}
        height={maxHeight}
        extensions={extensions}
        onChange={onChange}
        theme={resolvedTheme === 'light' ? 'light' : 'dark'}
        basicSetup={{
          lineNumbers: true,
          foldGutter: true,
          highlightActiveLine: true,
          bracketMatching: true,
          indentOnInput: true,
        }}
        className="text-sm font-mono"
      />
    </div>
  );
}
