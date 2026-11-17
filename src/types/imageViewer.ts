export interface ImageViewerPresentation {
 image:{url:string;title:string}|null;
 previewUrl:string|null;downloadUrl:string|null;filename:string;
 loading:boolean;sharing:boolean;
 notice:'shared'|'copied'|'download'|'shareFailed'|'loadFailed'|null;
 onOpen:(url:string,title:string)=>void;
 onClose:()=>void;onShare:()=>void;onRetry:()=>void;
}
