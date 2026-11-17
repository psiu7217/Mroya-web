export interface ChatAttachmentItem {
 id:string;file:File;filename:string;previewUrl:string|null;progress:number|null;
 status:'uploading'|'ready'|'error';error:string|null;
}
export interface ChatAttachmentsPresentation {
 items:ChatAttachmentItem[];
 onAdd:(files:File[])=>void;onRemove:(id:string)=>void;onRetry:(id:string)=>void;onClear:()=>void;
}
