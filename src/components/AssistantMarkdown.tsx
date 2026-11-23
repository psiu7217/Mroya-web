import React, {createContext, useContext, useMemo, useRef} from 'react';
import {createPortal} from 'react-dom';
import {Globe, X} from 'lucide-react';
import Markdown, {defaultUrlTransform, type Components} from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import {tr} from '../i18n';
import {DocumentImage} from './DocumentImage';
import {documentImageId} from '../utils/documentImage';
import {removeImageDownloadLinks} from '../utils/removeImageDownloadLinks';
import {groupWebSources} from '../utils/groupWebSources';

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

export const MobileSourcesTarget = createContext<HTMLElement|null>(null);

function WebSources({children}: {children: React.ReactNode}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const target = useContext(MobileSourcesTarget);
  const title = tr('webSources', {ns:'chat'});
  const links = React.Children.toArray(children).filter(child => !React.isValidElement(child) || child.type !== 'summary');

  const trigger = <button type="button" aria-haspopup="dialog" onClick={() => dialog.current?.showModal()}
    className="inline-flex min-h-8 items-center gap-1.5 rounded-md px-1.5 text-xs font-medium text-[var(--mroya-primary)] hover:bg-[var(--mroya-surface-muted)] sm:hidden">
    <Globe className="size-3.5" aria-hidden="true"/>{title}
  </button>;

  return <>
    <details className="mroya-web-sources hidden sm:block">{children}</details>
    {target ? createPortal(trigger,target) : trigger}
    <dialog ref={dialog} aria-label={title}
      onClick={event => {if (event.target === event.currentTarget) event.currentTarget.close();}}
      className="inset-x-0 top-auto bottom-0 m-0 max-h-[80dvh] w-full max-w-none overflow-y-auto overscroll-contain rounded-t-2xl bg-[var(--mroya-surface)] p-0 text-[var(--mroya-text)] backdrop:bg-black/55 sm:mx-auto sm:max-w-xl">
      <div className="p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <span className="mx-auto mb-3 block h-1 w-8 rounded-full bg-[var(--mroya-text-muted)]" aria-hidden="true"/>
        <header className="mb-3 flex items-center justify-between gap-2">
          <h2 className="m-0 font-semibold">{title}</h2>
          <button type="button" aria-label={tr('close',{ns:'common'})} onClick={() => dialog.current?.close()}
            className="grid size-10 place-items-center rounded-full hover:bg-[var(--mroya-surface-muted)]"><X className="size-5" aria-hidden="true"/></button>
        </header>
        {links}
      </div>
    </dialog>
  </>;
}

const renderDetails: NonNullable<Components['details']> = ({children,className}) => className === 'mroya-web-sources'
  ? <WebSources>{children}</WebSources> : <details className={className}>{children}</details>;

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
      rehypePlugins={variant === 'assistant' ? [removeImageDownloadLinks,[groupWebSources,tr('webSources',{ns:'chat'})]] : []} urlTransform={assistantUrlTransform}
      components={{
        a: ({href, children}) => href
          ? <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>
          : <span>{children}</span>,
        img: renderImage,
        details: renderDetails,
        table: ({children}) => <div className="mroya-markdown-scroll" role="region" aria-label={tr('messageTable',{ns:'chat'})} tabIndex={0}><table>{children}</table></div>,
        pre: ({children}) => <pre tabIndex={0}>{children}</pre>,
      }}>{content}</Markdown>
  </div>;
}
