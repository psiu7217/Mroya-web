import test from 'node:test';
import assert from 'node:assert/strict';
import {MroyaApi} from '../src/api/client.ts';
import {ApiError} from '../src/api/errors.ts';
import {ImageViewerController} from '../src/hooks/ImageViewerController.ts';
import type {ImageSharing} from '../src/hooks/ImageViewerController.ts';
import type {WorkspaceSource} from '../src/types/source.ts';
import {estimateImageGenerationProgress,imageGenerationPhase} from '../src/utils/imageGeneration.ts';
import {documentImageId} from '../src/utils/documentImage.ts';
import type {ToolTimelineEntry} from '../src/types/mroya.ts';

const id='10000000-0000-4000-8000-000000000001',path=`/api/v1/documents/${id}/original/`;
const png=Uint8Array.from([137,80,78,71,13,10,26,10,0,0,0,0]);
const file=()=>new File([png],'mroya-test.png',{type:'image/png'});
const tick=()=>new Promise<void>(resolve=>setImmediate(resolve));

test('the elapsed-time estimate advances and leaves the final percent for tool success',()=>{
 const progress=[0,5_000,20_000,45_000,180_000].map(estimateImageGenerationProgress);
 assert.equal(progress[0],8);
 for(let i=1;i<progress.length;i++)assert.ok(progress[i]>progress[i-1]);
 assert.equal(progress.at(-1),94);
 assert.equal(estimateImageGenerationProgress(600_000),94);
});

function setup(options:{source?:Partial<WorkspaceSource>;browser?:Partial<ImageSharing>}={}){
 const events:string[]=[],shared:File[]=[];let expired=0;
 const source={documentImage:async()=>{events.push('read');return file();},...options.source} as WorkspaceSource;
 const browser:ImageSharing={createUrl:()=>{events.push('create');return 'blob:private-image';},revokeUrl:()=>{events.push('revoke');},
  canShare:()=>true,share:async f=>{events.push('share');shared.push(f);},canCopy:()=>false,copy:async()=>{events.push('copy');},...options.browser};
 return {controller:new ImageViewerController(source,()=>{expired++;},browser),events,shared,expired:()=>expired};
}

test('original bytes use the existing owner-scoped session endpoint, safe MIME, size and signature',async()=>{
 const calls:{url:string;init?:RequestInit}[]=[];
 const api=new MroyaApi(async(url,init)=>{calls.push({url:String(url),init});return new Response(png,{headers:{'Content-Type':'image/png'}});});
 const actual=await api.documentImage(id);
 assert.equal(calls[0].url,path);assert.equal(calls[0].init?.credentials,'same-origin');
 assert.equal(calls[0].init?.redirect,'error');assert.equal(calls[0].init?.cache,'no-store');
 assert.equal(actual.type,'image/png');assert.deepEqual(new Uint8Array(await actual.arrayBuffer()),png);
 await assert.rejects(api.documentImage('https://foreign.test/image'),ApiError);
 for(const response of [new Response('<svg/>',{headers:{'Content-Type':'image/svg+xml'}}),
  new Response('<html>private</html>',{headers:{'Content-Type':'image/png'}}),
  new Response(png,{headers:{'Content-Type':'image/png','Content-Length':String(26*1024*1024)}})]){
  const unsafe=new MroyaApi(async()=>response);await assert.rejects(unsafe.documentImage(id),ApiError);
 }
});

test('opening preloads a private file and Share passes bytes synchronously before any further network request',async()=>{
 const {controller,events,shared}=setup();controller.open(path,'Cat');assert.equal(controller.snapshot().loading,true);
 await tick();assert.equal(controller.snapshot().downloadUrl,'blob:private-image');
 const sharing=controller.share();assert.deepEqual(events,['read','create','share']);
 await sharing;assert.equal(shared[0].type,'image/png');assert.equal(controller.snapshot().notice,'shared');
 controller.close();assert.equal(events.at(-1),'revoke');assert.equal(controller.snapshot().image,null);
});

test('unsupported native sharing copies the image or offers a download without sharing an inaccessible URL',async()=>{
 const copied=setup({browser:{canShare:()=>false,canCopy:()=>true}});
 copied.controller.open(path,'Cat');await tick();await copied.controller.share();
 assert.equal(copied.controller.snapshot().notice,'copied');assert.deepEqual(copied.events,['read','create','copy']);copied.controller.stop();
 const fallback=setup({browser:{canShare:()=>false}});fallback.controller.open(path,'Cat');await tick();await fallback.controller.share();
 assert.equal(fallback.controller.snapshot().notice,'download');assert.equal(fallback.shared.length,0);fallback.controller.stop();
});

test('cancelling the native share sheet is quiet; actual sharing errors remain retryable',async()=>{
 const cancelled=setup({browser:{share:async()=>{throw new DOMException('Cancelled','AbortError');}}});
 cancelled.controller.open(path,'Cat');await tick();await cancelled.controller.share();
 assert.equal(cancelled.controller.snapshot().notice,null);assert.equal(cancelled.controller.snapshot().sharing,false);cancelled.controller.stop();
 const failed=setup({browser:{share:async()=>{throw new Error('Unavailable');}}});
 failed.controller.open(path,'Cat');await tick();await failed.controller.share();
 assert.equal(failed.controller.snapshot().notice,'shareFailed');assert.equal(failed.controller.snapshot().sharing,false);failed.controller.stop();
});

test('closing, switching account or opening a new image rejects late private bytes and clears object URLs',async()=>{
 let resolve!:(f:File)=>void;
 const first=setup({source:{documentImage:()=>new Promise<File>(r=>{resolve=r;})}});
 first.controller.open(path,'Cat');first.controller.stop();resolve(file());await tick();
 assert.equal(first.controller.snapshot().image,null);assert.deepEqual(first.events,[]);
 const next=setup();for(const unsafe of ['https://foreign.test'+path,path+'?anything=1','//foreign.test'+path])next.controller.open(unsafe,'Unsafe');
 assert.equal(next.controller.snapshot().image,null);assert.deepEqual(next.events,[]);
 next.controller.open(path,'Cat');await tick();next.controller.open(path,'Other cat');await tick();
 assert.deepEqual(next.events,['read','create','revoke','read','create']);next.controller.stop();assert.equal(next.events.at(-1),'revoke');
});

test('session expiry clears image state; missing files can be explicitly reloaded',async()=>{
 const expired=setup({source:{documentImage:async()=>{throw new ApiError(401,'authentication_required','Expired');}}});
 expired.controller.open(path,'Cat');await tick();assert.equal(expired.expired(),1);assert.equal(expired.controller.snapshot().image,null);
 let reads=0;const retry=setup({source:{documentImage:async()=>{if(++reads===1)throw new ApiError(404,'not_found','Gone');return file();}}});
 retry.controller.open(path,'Cat');await tick();assert.equal(retry.controller.snapshot().notice,'loadFailed');
 retry.controller.retry();await tick();assert.equal(retry.controller.snapshot().notice,null);assert.equal(retry.controller.snapshot().filename,'mroya-test.png');retry.controller.stop();
});

test('generation animation follows real tool lifecycle and never persists after errors or interruption',()=>{
 const activity:ToolTimelineEntry={kind:'tool',id:'t1-c1',sequence:1,toolKind:'tool',title:'Generating image',toolName:'generate_image',status:'running',phase:'started'};
 const message={status:'streaming',content:'',timeline:[activity]};
 assert.equal(imageGenerationPhase(message),'generating');
 assert.equal(imageGenerationPhase({...message,timeline:[{...activity,status:'success',phase:'finished'}]}),'finishing');
 assert.equal(imageGenerationPhase({...message,status:'failed'}),null);
 assert.equal(imageGenerationPhase({...message,timeline:[{...activity,status:'interrupted'}]}),null);
 assert.equal(imageGenerationPhase({...message,timeline:[{...activity,status:'failure'}]}),null);
 assert.equal(imageGenerationPhase({...message,status:'completed'}),null);
 assert.equal(documentImageId(path),id);assert.equal(documentImageId('https://app.heymroya.com'+path),null);
});
