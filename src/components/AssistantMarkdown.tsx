import React, {useMemo} from 'react';
import Markdown, {defaultUrlTransform, type Components} from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import {tr} from '../i18n';
import {DocumentImage} from './DocumentImage';
import {documentImageId} from '../utils/documentImage';
import {removeImageDownloadLinks} from '../utils/removeImageDownloadLinks';

export interface AssistantMarkdownProps {
  content: string;
  variant?: 'assistant' | 'user';
  onImageOpen?:(url:string,title:string)=>void;
  eagerImages?:boolean;
}

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

export function AssistantMarkdown({content, variant = 'assistant', onImageOpen, eagerImages=false}: AssistantMarkdownProps) {
  const renderImage = useMemo<NonNullable<Components['img']>>(() => ({alt,src}) => {
    if(variant!=='assistant'||typeof src!=='string'||!documentImageId(src))
      return <span className="mroya-markdown-image">{alt || tr('imageOmitted',{ns:'notes'})}</span>;
    const label=alt || tr('imageViewerTitle',{ns:'chat'});
    const loading=eagerImages?'eager':'lazy';
    return onImageOpen ? (
      <button type="button" data-image-url={src} onClick={() => onImageOpen(src, alt || '')}
        aria-label={tr('imageOpen',{ns:'chat'})} className="mroya-chat-image cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--mroya-primary)]">
        <DocumentImage src={src} alt={label} loading={loading} referrerPolicy="no-referrer" />
      </button>
    ) : <DocumentImage className="mroya-chat-image" src={src} alt={label} loading={loading} referrerPolicy="no-referrer" />;
  }, [variant,onImageOpen,eagerImages]);

  return <div className={variant === 'user'
    ? 'mroya-markdown mroya-markdown-user text-[15px] leading-[23px] text-inherit'
    : 'mroya-markdown text-[15px] sm:text-[16px] leading-[24px] sm:leading-[25px] text-[var(--mroya-text)]'}>
    <Markdown skipHtml remarkPlugins={[remarkGfm, remarkBreaks]}
      rehypePlugins={variant === 'assistant' ? [removeImageDownloadLinks] : []} urlTransform={assistantUrlTransform}
      components={{
        a: ({href, children}) => href
          ? <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>
          : <span>{children}</span>,
        img: renderImage,
        table: ({children}) => <div className="mroya-markdown-scroll" role="region" aria-label={tr('messageTable',{ns:'chat'})} tabIndex={0}><table>{children}</table></div>,
        pre: ({children}) => <pre tabIndex={0}>{children}</pre>,
      }}>{content}</Markdown>
  </div>;
}
