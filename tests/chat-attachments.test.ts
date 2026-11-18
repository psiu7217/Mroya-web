import test from 'node:test';
import assert from 'node:assert/strict';
import {ChatAttachmentsController} from '../src/hooks/ChatAttachmentsController.ts';
import {MroyaApi} from '../src/api/client.ts';
import type {WorkspaceSource} from '../src/types/source.ts';
import type {DocumentDto} from '../src/types/documents.ts';
const id='00000000-0000-4000-8000-000000000001';
const record=():DocumentDto=>({id,filename:'guide.txt',title:'guide.txt',mime_type:'text/plain',size_bytes:3,status:'staged',error_code:null,category:null,searchable:false,document_date:null,document_type:'',coverage:'unknown',created_at:'2026-11-17T00:00:00Z',original_url:`/api/v1/documents/${id}/original/`});
const source=(changes:Partial<WorkspaceSource>)=>changes as WorkspaceSource;
const tick=()=>new Promise<void>(resolve=>setImmediate(resolve));

test('selection immediately uploads each file and reports bytes without recognition polling',async()=>{
 let finish:(file:DocumentDto)=>void=()=>{},reads=0;
 const c=new ChatAttachmentsController(source({uploadStagedDocument:async(_file,_id,progress)=>{progress(0.4);return new Promise(resolve=>{finish=resolve;});},document:async()=>{reads++;return record();}}),()=>id);
 c.start();const file=new File(['abc'],'guide.txt');c.add([file]);
 assert.equal(c.snapshot()[0].status,'uploading');assert.equal(c.snapshot()[0].progress,0.4);
 const send=c.prepare([file]);finish(record());assert.equal((await send)[0].status,'staged');
 assert.equal(c.snapshot()[0].status,'ready');assert.equal(reads,0);c.accepted([file]);assert.equal(c.snapshot().length,0);c.stop();
});

test('cancel aborts only the selected file, discards its server id and ignores a late response',async()=>{
 const discarded:string[]=[],callbacks:((value:DocumentDto)=>void)[]=[],signals:AbortSignal[]=[];let n=0;
 const c=new ChatAttachmentsController(source({uploadStagedDocument:async(_f,_id,_p,signal)=>{signals.push(signal!);return new Promise(resolve=>callbacks.push(resolve));},discardStagedUpload:async id=>{discarded.push(id);}}),()=>`${id.slice(0,-1)}${++n}`);
 c.start();const files=[new File(['a'],'a.txt'),new File(['b'],'b.txt')];c.add(files);const first=c.snapshot()[0].id;
 c.remove(first);callbacks[0](record());callbacks[1](record());await tick();
 assert.equal(signals[0].aborted,true);assert.equal(signals[1].aborted,false);assert.deepEqual(discarded,[first]);
 assert.equal(c.snapshot().length,1);assert.equal(c.snapshot()[0].filename,'b.txt');c.accepted([files[1]]);c.stop();
});

test('retry reuses the same upload id after a lost response and accepted files are never discarded',async()=>{
 const ids:string[]=[],discarded:string[]=[];
 const c=new ChatAttachmentsController(source({uploadStagedDocument:async(_f,uploadId)=>{ids.push(uploadId);if(ids.length===1)throw Error('lost');return record();},discardStagedUpload:async id=>{discarded.push(id);}}),()=>id);
 c.start();const file=new File(['x'],'x.txt');c.add([file]);await tick();assert.equal(c.snapshot()[0].status,'error');
 c.retry(id);await c.prepare([file]);c.accepted([file]);c.stop();assert.deepEqual(ids,[id,id]);assert.deepEqual(discarded,[]);
});

test('account stop cancels all temporary files and cannot prepare a message from late uploads',async()=>{
 let complete:(value:DocumentDto)=>void=()=>{};
 const c=new ChatAttachmentsController(source({uploadStagedDocument:async()=>new Promise(resolve=>{complete=resolve;}),discardStagedUpload:async()=>{}}),()=>id);
 c.start();const file=new File(['x'],'x.txt');c.add([file]);const send=c.prepare([file]);c.stop();complete(record());
 await assert.rejects(send);assert.deepEqual(c.snapshot(),[]);
});

test('XHR uses the existing CSRF session and actual upload progress without a multipart boundary',async()=>{
 const previous=globalThis.XMLHttpRequest;let xhr:any;
 class FakeXHR {
  upload:any={};status=201;responseText=JSON.stringify(record());withCredentials=false;timeout=0;headers:Record<string,string>={};
  onload?:()=>void;onabort?:()=>void;onerror?:()=>void;ontimeout?:()=>void;method='';url='';
  constructor(){xhr=this;}open(method:string,url:string){this.method=method;this.url=url;}
  setRequestHeader(key:string,value:string){this.headers[key]=value;}getResponseHeader(){return 'application/json';}
  send(body:FormData){assert.equal(body.get('upload_id'),id);this.upload.onprogress({lengthComputable:true,loaded:40,total:100});queueMicrotask(()=>this.onload?.());}
  abort(){this.onabort?.();}
 }
 Object.defineProperty(globalThis,'XMLHttpRequest',{configurable:true,writable:true,value:FakeXHR});
 try{
  const api=new MroyaApi(async()=>new Response(JSON.stringify({csrf_token:'synthetic-csrf'}),{headers:{'Content-Type':'application/json'}}));
  const progress:(number|null)[]=[];assert.equal((await api.uploadStagedDocument(new File(['abc'],'guide.txt'),id,p=>progress.push(p))).status,'staged');
  assert.equal(xhr.url,'/api/v1/documents/upload/?staged=1');assert.equal(xhr.withCredentials,true);
  assert.equal(xhr.headers['X-CSRFToken'],'synthetic-csrf');assert.equal(xhr.headers['Content-Type'],undefined);assert.deepEqual(progress,[0.4,1]);
 }finally{if(previous)globalThis.XMLHttpRequest=previous;else delete (globalThis as any).XMLHttpRequest;}
});
