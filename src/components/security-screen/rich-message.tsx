import { Fragment, type ReactNode } from 'react';

const TAG = /<(code|strong|link)>(.*?)<\/\1>/g;

/**
 * Renders the `<code>`, `<strong>` and `<link>` tags of an i18n message; `t()`
 * returns plain strings. `link` draws the `<link>` content; without it the
 * content stays as plain text.
 */
export function RichMessage({ text, link }: { text: string; link?: (content: string) => ReactNode }) {
  const parts = text.split(TAG);
  const nodes = [];
  // split() with two groups yields: text, tag, content, text, tag, content, …
  for (let i = 0; i < parts.length; i += 3) {
    nodes.push(<Fragment key={i}>{parts[i]}</Fragment>);
    if (i + 2 >= parts.length) break;
    const content = parts[i + 2];
    nodes.push(
      parts[i + 1] === 'code' ? (
        <code key={i + 1} className="font-mono">{content}</code>
      ) : parts[i + 1] === 'link' ? (
        <Fragment key={i + 1}>{link ? link(content) : content}</Fragment>
      ) : (
        <span key={i + 1} className="font-medium text-text">{content}</span>
      ),
    );
  }
  return <>{nodes}</>;
}
