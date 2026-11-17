import React, {useState} from 'react';
import {FileText} from 'lucide-react';
import {tr} from '../i18n';
import type {ChatMessageAttachment} from '../types/chatAttachments';
import {isPreviewableDocumentImage} from '../utils/documentImage';

type OpenImage = (url: string, title: string) => void;

function AttachmentCard({file, onImageOpen}: {file: ChatMessageAttachment; onImageOpen?: OpenImage}) {
 const [previewFailed, setPreviewFailed] = useState(false);
 const canPreview = !previewFailed && isPreviewableDocumentImage(file.mimeType, file.originalUrl, file.id);
 const frame = 'w-full overflow-hidden rounded-xl border border-[var(--mroya-divider)] bg-[var(--mroya-surface-muted)] hover:border-[var(--mroya-primary)] focus-visible:outline-2 focus-visible:outline-[var(--mroya-primary)]';

 if (canPreview) {
  const image = <img src={file.originalUrl} alt="" loading="lazy" decoding="async"
   className="aspect-square w-full object-cover" onError={() => setPreviewFailed(true)}/>;
  return <li className="w-32 max-w-full sm:w-40">
   {onImageOpen
    ? <button type="button" className={`${frame} block cursor-zoom-in`} data-image-url={file.originalUrl}
      aria-label={tr('openAttachmentPreview', {ns:'chat', name:file.filename})} title={file.filename}
      onClick={() => onImageOpen(file.originalUrl, file.filename)}>{image}</button>
    : <a href={file.originalUrl} className={`${frame} block`} target="_blank" rel="noopener noreferrer"
      aria-label={file.filename} title={file.filename}>{image}</a>}
  </li>;
 }

 const extension = /\.([a-z0-9]{1,8})$/i.exec(file.filename)?.[1];
 const type = file.mimeType === 'application/pdf' ? 'PDF' : extension?.toUpperCase() ?? tr('attachmentFileType', {ns:'chat'});
 return <li className="w-60 max-w-full sm:w-72">
  <a href={file.originalUrl} target="_blank" rel="noopener noreferrer" title={file.filename}
   className={`${frame} flex items-center gap-3 p-2.5 text-left text-[var(--mroya-text)] hover:bg-[var(--mroya-surface-active)]`}>
   <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--mroya-surface-active)] text-[var(--mroya-primary)]">
    <FileText className="h-5 w-5" aria-hidden="true"/>
   </span>
   <span className="min-w-0 flex-1">
    <span className="block truncate text-sm font-medium">{file.filename}</span>
    <span className="mt-0.5 block text-xs text-[var(--mroya-text-muted)]">{type}</span>
   </span>
  </a>
 </li>;
}

export function MessageAttachments({files, onImageOpen}: {files: ChatMessageAttachment[]; onImageOpen?: OpenImage}) {
 return <ul className="mb-2 flex max-w-full flex-wrap justify-end gap-2 sm:max-w-[88%]"
  aria-label={tr('attachmentsLabel', {ns:'chat'})}>
  {files.map(file => <AttachmentCard key={file.id} file={file} onImageOpen={onImageOpen}/>)}
 </ul>;
}
