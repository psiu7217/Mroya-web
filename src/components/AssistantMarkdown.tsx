import React from 'react';
import Markdown, {defaultUrlTransform} from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';

export interface AssistantMarkdownProps { content: string; variant?: 'assistant' | 'user' }

/** Narrow the library's safe URL policy; inspect encoded/control-character schemes too. */
export function assistantUrlTransform(url: string): string {
  let decoded = url;
  try {
    for (let i = 0; i < 8; i++) {
      const next = decodeURIComponent(decoded);
      if (next === decoded) break;
      decoded = next;
      if (i === 7) return '';
    }
  } catch { return ''; }
  const inspected = decoded.replace(/[\s\u0000-\u0020\u007f]/g, '');
  if (inspected.includes('\\') || inspected.startsWith('//')) return '';
  const colon = inspected.indexOf(':');
  const boundary = inspected.search(/[/?#]/);
  if (colon >= 0 && (boundary < 0 || colon < boundary) &&
      !/^(https?|mailto):/i.test(inspected)) return '';
  return defaultUrlTransform(url);
}

export function AssistantMarkdown({content, variant = 'assistant'}: AssistantMarkdownProps) {
  return <div className={variant === 'user'
    ? 'mroya-markdown mroya-markdown-user text-[15px] leading-[23px] text-inherit'
    : 'mroya-markdown text-[15px] sm:text-[16px] leading-[24px] sm:leading-[25px] text-[var(--mroya-text)]'}>
    <Markdown skipHtml remarkPlugins={[remarkGfm, remarkBreaks]} urlTransform={assistantUrlTransform}
      components={{
        a: ({href, children}) => href
          ? <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>
          : <span>{children}</span>,
        img: ({alt}) => <span className="mroya-markdown-image">{alt || 'Image omitted'}</span>,
        table: ({children}) => <div className="mroya-markdown-scroll" role="region" aria-label="Message table" tabIndex={0}><table>{children}</table></div>,
        pre: ({children}) => <pre tabIndex={0}>{children}</pre>,
      }}>{content}</Markdown>
  </div>;
}
