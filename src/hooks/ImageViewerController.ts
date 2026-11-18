import {ApiError} from '../api/errors.ts';
import {documentImageId} from '../utils/documentImage.ts';
import type {WorkspaceSource} from '../types/source.ts';
import type {ImageViewerPresentation} from '../types/imageViewer.ts';

export interface ImageSharing {
 createUrl:(file:File)=>string;revokeUrl:(url:string)=>void;
 canShare:(file:File)=>boolean;share:(file:File,title:string)=>Promise<void>;
 canCopy:(file:File)=>boolean;copy:(file:File)=>Promise<void>;
}
export const browserImageSharing:ImageSharing={
 createUrl:file=>URL.createObjectURL(file),revokeUrl:url=>URL.revokeObjectURL(url),
 canShare:file=>typeof navigator!=='undefined'&&typeof navigator.share==='function'&&typeof navigator.canShare==='function'&&navigator.canShare({files:[file]}),
 share:(file,title)=>navigator.share({files:[file],title}),
 canCopy:file=>file.type==='image/png'&&typeof navigator!=='undefined'&&typeof navigator.clipboard?.write==='function'&&typeof ClipboardItem!=='undefined',
 copy:file=>navigator.clipboard.write([new ClipboardItem({[file.type]:file})]),
};
type State=Pick<ImageViewerPresentation,'image'|'previewUrl'|'downloadUrl'|'filename'|'loading'|'sharing'|'notice'>;
const initial=():State=>({image:null,previewUrl:null,downloadUrl:null,filename:'',loading:false,sharing:false,notice:null});

/** Private bytes are prefetched on opening, so Share retains its click activation. */
export class ImageViewerController {
 private state=initial();private listeners=new Set<()=>void>();private file:File|null=null;
 private request?:AbortController;private epoch=0;private active=true;
 private source:WorkspaceSource;private expired:()=>void;private browser:ImageSharing;
 constructor(source:WorkspaceSource,expired:()=>void,browser:ImageSharing=browserImageSharing){this.source=source;this.expired=expired;this.browser=browser;}
 snapshot=()=>this.state;
 subscribe=(fn:()=>void)=>{this.listeners.add(fn);return()=>{this.listeners.delete(fn);};};
 private emit(patch:Partial<State>){this.state={...this.state,...patch};this.listeners.forEach(fn=>fn());}
 start=()=>{this.active=true;};
 close=()=>{this.epoch++;this.request?.abort();if(this.state.downloadUrl)this.browser.revokeUrl(this.state.downloadUrl);this.file=null;this.state=initial();this.emit({});};
 stop=()=>{this.active=false;this.close();};
 open=(url:string,title:string)=>{
  if(!this.active||!documentImageId(url)||!this.source.documentImage)return;
  this.close();this.emit({image:{url,title:title.slice(0,240)},loading:true});void this.load();
 };
 retry=()=>{if(this.active&&this.state.image&&!this.state.loading)void this.load();};
 private async load(){
  const image=this.state.image,id=image&&documentImageId(image.url);if(!id||!this.source.documentImage)return;
  const epoch=this.epoch,request=this.request=new AbortController();this.emit({loading:true,notice:null});
  try{
   const file=await this.source.documentImage(id,request.signal);
   if(!this.active||request.signal.aborted||epoch!==this.epoch)return;
   const url=this.browser.createUrl(file);this.file=file;
   this.emit({loading:false,previewUrl:url,downloadUrl:url,filename:file.name});
  }catch(error){
   if(!this.active||request.signal.aborted||epoch!==this.epoch)return;
   if(error instanceof ApiError&&error.status===401){this.stop();this.expired();return;}
   this.emit({loading:false,notice:'loadFailed'});
  }
 }
 share=async()=>{
  if(!this.active||!this.file||this.state.loading||this.state.sharing)return;
  const file=this.file,title=this.state.image?.title??'',epoch=this.epoch;
  this.emit({sharing:true,notice:null});
  try{
   // No network await before either activation-gated browser operation.
   if(this.browser.canShare(file)){
    await this.browser.share(file,title);
    if(this.active&&epoch===this.epoch)this.emit({notice:'shared'});
   }else if(this.browser.canCopy(file)){
    await this.browser.copy(file);
    if(this.active&&epoch===this.epoch)this.emit({notice:'copied'});
   }else this.emit({notice:'download'});
  }catch(error){
   if(this.active&&epoch===this.epoch&&!(error instanceof Error&&error.name==='AbortError'))this.emit({notice:'shareFailed'});
  }finally{if(this.active&&epoch===this.epoch)this.emit({sharing:false});}
 };
 presentation=():ImageViewerPresentation=>({...this.state,onOpen:this.open,onClose:this.close,onShare:()=>void this.share(),onRetry:this.retry});
}
