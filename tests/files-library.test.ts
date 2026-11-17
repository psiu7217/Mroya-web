import test from 'node:test';
import assert from 'node:assert/strict';
import {FilesController} from '../src/hooks/FilesController.ts';
import {MroyaApi} from '../src/api/client.ts';
import {ApiError} from '../src/api/errors.ts';
import {readDocumentCategory,readDocumentCategories,readDocumentDetail,readDocumentPage,readDocumentDeletion} from '../src/api/documents.ts';
import type {WorkspaceSource} from '../src/types/source.ts';
import type {DocumentCategoryDto,DocumentDetail} from '../src/types/documents.ts';

const id='10000000-0000-4000-8000-000000000001',folderId='10000000-0000-4000-8000-000000000002';
const folder:DocumentCategoryDto={id:folderId,parent_id:null,name:'Screenshots',path:['Screenshots'],search_enabled:false,effective_search_enabled:false,policy_source:'model',version:1};
const detail=(changes:Partial<DocumentDetail>={}):DocumentDetail=>({id,filename:'guide.txt',title:'Guide',mime_type:'text/plain',size_bytes:200,
 status:'ready',error_code:null,category:folder,searchable:false,document_date:null,document_type:'',coverage:'complete',created_at:'2026-11-17T10:00:00Z',original_url:`/api/v1/documents/${id}/original/`,keywords:['training'],summary:'A reference guide',
 analysis_version:1,page_count:2,pages:[{page:1,text:'First section'},{page:2,text:'Last section'}],facts:[],values:[],analysis_author:'model',analysis_model:'',processed_at:'2026-11-17T10:01:00Z',...changes});
const page=()=>({documents:[detail()],next_offset:null,total:1});
const source=(changes:Partial<WorkspaceSource>={}):WorkspaceSource=>({documents:async()=>page(),documentCategories:async()=>[folder],documentDetail:async()=>detail(),...changes} as unknown as WorkspaceSource);
const tick=()=>new Promise<void>(resolve=>setImmediate(resolve));
async function start(c:FilesController){c.start();c.setVisible(true);await tick();}

test('library DTOs accept excluded files and all source pages but reject unsafe links and category cycles',()=>{
 assert.equal(readDocumentPage(page()).documents[0].searchable,false);
 assert.equal(readDocumentDetail(detail(),id).pages.length,2);
 assert.equal(readDocumentCategory(folder).search_enabled,false);
 assert.throws(()=>readDocumentDetail(detail({original_url:'https://foreign.example/file'}),id));
 assert.throws(()=>readDocumentDetail({...detail(),pages:[{page:0,text:'bad'}]},id));
 assert.throws(()=>readDocumentCategories({categories:[{...folder,parent_id:folder.id}]}));
 assert.throws(()=>readDocumentPage({...page(),next_offset:49}));
});

test('list filters, status polling and versioned corrections use the existing session and CSRF transport',async()=>{
 const received:{url:string;init?:RequestInit}[]=[];
 const api=new MroyaApi(async(url,init)=>{received.push({url:String(url),init});
  const body=String(url).endsWith('auth/csrf/')?{csrf_token:'synthetic-csrf'}:init?.method==='PATCH'?detail({analysis_version:2,analysis_author:'user'}):String(url).endsWith('?brief=1')?detail():page();
  return new Response(JSON.stringify(body),{headers:{'Content-Type':'application/json'}});
 });
 await api.documents({category:folderId,q:'training',order:'name',offset:0});
 await api.saveDocument(id,{analysis_version:1,title:'Corrected',summary:'My description',keywords:['training'],category_id:folderId});
 await api.document(id);assert.equal(received.at(-1)?.url,`/api/v1/documents/${id}/?brief=1`);
 assert.match(received[0].url,/category=10000000/);assert.match(received[0].url,/q=training/);
 const write=received.find(r=>r.init?.method==='PATCH')!;
 assert.equal(write.url,`/api/v1/documents/${id}/`);assert.equal(write.init?.credentials,'same-origin');
 assert.equal((write.init?.headers as Record<string,string>)['X-CSRFToken'],'synthetic-csrf');
 assert.equal(JSON.parse(String(write.init?.body)).analysis_version,1);
});

test('a late list response cannot replace a newer folder selection',async()=>{
 let oldResolve:(value:ReturnType<typeof page>)=>void=()=>{};
 const c=new FilesController(source({documents:async options=>options?.category?{documents:[],next_offset:null,total:0}:new Promise(resolve=>{oldResolve=resolve;})}),()=>{});
 c.start();c.setVisible(true);c.category(folderId);await tick();
 oldResolve(page());await tick();
 assert.equal(c.snapshot().category,folderId);assert.deepEqual(c.snapshot().rows,[]);c.stop();
});

test('opening another file or stopping an account discards late detail and upload results',async()=>{
 let resolveDetail:(value:DocumentDetail)=>void=()=>{};
 const c=new FilesController(source({documentDetail:async()=>new Promise(resolve=>{resolveDetail=resolve;})}),()=>{});
 await start(c);c.select(id);c.select(null);resolveDetail(detail());await tick();
 assert.equal(c.snapshot().detail,null);
 let finish:(value:DocumentDetail)=>void=()=>{};
 const uploads=new FilesController(source({uploadDocument:async()=>new Promise(resolve=>{finish=resolve;})}),()=>{},()=>id);
 await start(uploads);const pending=uploads.upload([new File(['hello'],'guide.txt')]);uploads.stop();finish(detail());
 assert.equal(await pending,false);assert.deepEqual(uploads.snapshot().rows,[]);c.stop();
});

test('ambiguous corrections reconcile with GET and never automatically repeat PATCH',async()=>{
 let writes=0,reads=0;
 const c=new FilesController(source({documentDetail:async()=>{reads++;return detail({analysis_version:reads});},saveDocument:async()=>{writes++;throw new ApiError(409,'document_conflict','changed');}}),()=>{});
 await start(c);c.select(id);await tick();
 assert.equal(await c.save({title:'New title',summary:'Description',keywords:[],category_id:folderId}),false);
 assert.equal(writes,1);assert.ok(reads>=2);assert.ok(c.snapshot().detailError);c.stop();
});

test('manual upload retry reuses the same id after an ambiguous response',async()=>{
 const ids:string[]=[];let attempts=0;
 const c=new FilesController(source({uploadDocument:async(_file,uploadId)=>{ids.push(uploadId);if(++attempts===1)throw Error('lost response');return detail();}}),()=>{},()=>id);
 await start(c);const file=new File(['hello'],'guide.txt');
 assert.equal(await c.upload([file]),false);assert.equal(await c.upload([file]),true);
 assert.deepEqual(ids,[id,id]);c.stop();
});

test('document deletion uses the authenticated CSRF transport and validates folder receipts',async()=>{
 const requests:{url:string;init?:RequestInit}[]=[];
 const api=new MroyaApi(async(url,init)=>{requests.push({url:String(url),init});
  return new Response(JSON.stringify(String(url).endsWith('auth/csrf/')?{csrf_token:'delete-csrf'}:{status:'deleted',deleted_category_ids:[folderId]}),{headers:{'Content-Type':'application/json'}});
 });
 assert.deepEqual(await api.deleteDocument(id),{status:'deleted',deleted_category_ids:[folderId]});
 const write=requests.find(request=>request.init?.method==='DELETE')!;
 assert.equal(write.url,`/api/v1/documents/${id}/`);assert.equal(write.init?.credentials,'same-origin');
 assert.equal((write.init?.headers as Record<string,string>)['X-CSRFToken'],'delete-csrf');
 assert.deepEqual(JSON.parse(String(write.init?.body)),{});
 assert.throws(()=>readDocumentDeletion({status:'deleted',deleted_category_ids:['bad-id']}));
 assert.throws(()=>readDocumentDeletion({status:'deleted',deleted_category_ids:[folderId,folderId]}));
 assert.deepEqual(readDocumentDetail(detail({status:'needs_attention',review_reasons:['unverified_values']}),id).review_reasons,['unverified_values']);
 assert.throws(()=>readDocumentDetail({...detail(),review_reasons:['unexpected']},id));
});

test('deleting the last file in a child folder returns to its surviving parent',async()=>{
 const parentId='10000000-0000-4000-8000-000000000003',parent={...folder,id:parentId,name:'Projects',path:['Projects']};
 const child={...folder,parent_id:parentId,path:['Projects','Training']};let deleted=false,writes=0;
 const c=new FilesController(source({documentCategories:async()=>deleted?[parent]:[parent,child],
  documents:async options=>{assert.ok(!deleted||options?.category!==folderId,'Do not request a deleted folder');return deleted?{documents:[],next_offset:null,total:0}:page();},
  deleteDocument:async()=>{writes++;deleted=true;return {status:'deleted',deleted_category_ids:[folderId]};}}),()=>{});
 await start(c);c.category(folderId);await tick();c.select(id);await tick();
 assert.equal(writes,0);assert.equal(await c.presentation().onDelete(),true);
 assert.equal(writes,1);assert.equal(c.snapshot().category,parentId);assert.equal(c.snapshot().selectedId,null);
 assert.deepEqual(c.snapshot().categories,[parent]);assert.deepEqual(c.snapshot().rows,[]);c.stop();
});

test('deleting a whole empty path returns to All files and removes folder cards',async()=>{
 let gone=false;
 const c=new FilesController(source({documentCategories:async()=>gone?[]:[folder],documents:async()=>gone?{documents:[],next_offset:null,total:0}:page(),
  deleteDocument:async()=>{gone=true;return {status:'deleted',deleted_category_ids:[folderId]};}}),()=>{});
 await start(c);c.category(folderId);await tick();c.select(id);await tick();
 assert.equal(await c.deleteSelected(),true);assert.equal(c.snapshot().category,'');
 assert.equal(c.snapshot().total,0);assert.deepEqual(c.snapshot().categories,[]);assert.equal(c.snapshot().detail,null);c.stop();
});

test('a lost delete response is reconciled with GET and never repeated automatically',async()=>{
 let gone=false,writes=0;
 const c=new FilesController(source({documentCategories:async()=>gone?[]:[folder],documents:async()=>gone?{documents:[],next_offset:null,total:0}:page(),
  documentDetail:async()=>{if(gone)throw new ApiError(404,'not_found','Gone');return detail();},
  deleteDocument:async()=>{writes++;gone=true;throw new Error('Lost response');}}),()=>{});
 await start(c);c.category(folderId);await tick();c.select(id);await tick();
 assert.equal(await c.deleteSelected(),true);assert.equal(writes,1);assert.equal(c.snapshot().category,'');
 assert.equal(c.snapshot().selectedId,null);assert.equal(c.snapshot().detailError,null);c.stop();
});

test('an unconfirmed deletion keeps the file and exposes a deliberate retry',async()=>{
 let writes=0;
 const c=new FilesController(source({deleteDocument:async()=>{writes++;throw new Error('Network failure');}}),()=>{});
 await start(c);c.select(id);await tick();
 assert.equal(await c.deleteSelected(),false);assert.equal(writes,1);
 assert.equal(c.snapshot().selectedId,id);assert.equal(c.snapshot().rows[0].id,id);assert.ok(c.snapshot().detailError);c.stop();
});

test('late list data and an account switch cannot resurrect a deleted file',async()=>{
 let listCalls=0,gone=false,resolveList:(value:ReturnType<typeof page>)=>void=()=>{};
 const c=new FilesController(source({documents:async()=>{listCalls++;if(listCalls===2)return new Promise(resolve=>{resolveList=resolve;});return gone?{documents:[],next_offset:null,total:0}:page();},
  documentCategories:async()=>gone?[]:[folder],deleteDocument:async()=>{gone=true;return {status:'deleted',deleted_category_ids:[folderId]};}}),()=>{});
 await start(c);c.select(id);await tick();void c.refresh();await tick();
 assert.equal(await c.deleteSelected(),true);resolveList(page());await tick();assert.deepEqual(c.snapshot().rows,[]);c.stop();
 let finish:(value:{status:'deleted';deleted_category_ids:string[]})=>void=()=>{};
 const stopped=new FilesController(source({deleteDocument:async()=>new Promise(resolve=>{finish=resolve;})}),()=>{});
 await start(stopped);stopped.select(id);await tick();const pending=stopped.deleteSelected();stopped.stop();finish({status:'deleted',deleted_category_ids:[]});
 assert.equal(await pending,false);assert.deepEqual(stopped.snapshot().rows,[]);
});

test('session expiry clears account data and invokes the existing expiry handler',async()=>{
 let expired=0;
 const c=new FilesController(source({documents:async()=>{throw new ApiError(401,'authentication_required','expired');}}),()=>{expired++;});
 await start(c);assert.equal(expired,1);assert.deepEqual(c.snapshot().rows,[]);assert.equal(c.snapshot().detail,null);c.stop();
});
