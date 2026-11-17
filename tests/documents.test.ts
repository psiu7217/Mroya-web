import test from 'node:test';
import assert from 'node:assert/strict';
import {MroyaApi} from '../src/api/client.ts';
import {readDocument,readAttachments} from '../src/api/documents.ts';
import {readConversationHistory} from '../src/api/conversations.ts';
import {DocumentUploads} from '../src/hooks/DocumentUploads.ts';
import {LiveWorkspaceController} from '../src/hooks/LiveWorkspaceController.ts';
import {chatPresentation} from '../src/hooks/liveAdapters.ts';
import type {WorkspaceSource} from '../src/types/source.ts';
import type {DocumentDto} from '../src/types/documents.ts';

const id='00000000-0000-4000-8000-000000000001',chat='00000000-0000-4000-8000-000000000002';
const record=(changes:Partial<DocumentDto>={}):DocumentDto=>({id,filename:'screenshot.png',title:'Screenshot',mime_type:'image/png',size_bytes:3,
 status:'ready',error_code:null,category:{path:['Screenshots'],search_enabled:false,effective_search_enabled:false},searchable:false,
 document_date:null,document_type:'Screenshot',coverage:'complete',created_at:'2026-11-17T00:00:00Z',original_url:`/api/v1/documents/${id}/original/`,...changes});
const json=(value:unknown)=>new Response(JSON.stringify(value),{headers:{'Content-Type':'application/json'}});
const caps={api_version:'v1' as const,chat:true,documents:true,memory_read:false,memory_mutations_via_chat:true,memory_mutations_rest:false,
 calendar_rest:false,connections_rest:false,reminders:false,local_recurrence:false,sse_token_streaming:false};
const empty={conversation_id:chat,messages:[],next_before:null};
function source(changes:Partial<WorkspaceSource>={}):WorkspaceSource{return {kind:'live',session:async()=>({status:'guest'}),login:async()=>{throw Error('unused');},logout:async()=>{},
 capabilities:async()=>caps,history:async()=>empty,memories:async()=>({memories:[],total:0}),map:async()=>({nodes:[],edges:[]}),
 turn:async()=>({turn_status:'completed',summary:'',events:[]}),send:async()=>{},...changes};}

test('upload sends real multipart bytes with existing session and CSRF, without declaring a multipart boundary',async()=>{
 let writes=0;
 const api=new MroyaApi((async(url,init)=>{
  if(String(url).endsWith('auth/csrf/'))return json({csrf_token:'csrf-document-test'});
  assert.equal(url,'/api/v1/documents/upload/');assert.equal(init?.credentials,'same-origin');
  assert.equal(init?.redirect,'error');assert.equal((init?.headers as Record<string,string>)['X-CSRFToken'],'csrf-document-test');
  assert.equal((init?.headers as Record<string,string>)['Content-Type'],undefined);
  const body=init?.body as FormData;assert.equal(await (body.get('file') as File).text(),'abc');
  assert.equal(body.get('context'),'Translate');assert.equal(body.get('upload_id'),id);writes++;
  return json(record());
 }) as typeof fetch);
 assert.equal((await api.uploadDocument(new File(['abc'],'screenshot.png'),id,'Translate')).searchable,false);
 assert.equal(writes,1);
});

test('malformed original links and inconsistent category policy are rejected before display',()=>{
 assert.throws(()=>readDocument({...record(),original_url:'https://foreign.example/private'}));
 assert.throws(()=>readDocument({...record(),searchable:true}));
 assert.throws(()=>readAttachments([record(),record()]));
 assert.equal(readDocument(record()).category?.path[0],'Screenshots');
});

test('document keywords are optional for older servers and validated when present',()=>{
 assert.equal(readDocument(record()).keywords,undefined);
 assert.deepEqual(readDocument(record({keywords:['сметы','бюджетирование']})).keywords,['сметы','бюджетирование']);
 assert.throws(()=>readDocument({...record(),keywords:'all table values'}));
 assert.throws(()=>readDocument(record({keywords:['   ']})));
});

test('history retains excluded files and maps the authorized original link into the shared UI',()=>{
 const history=readConversationHistory({conversation_id:chat,next_before:null,messages:[{id,sequence:1,role:'user',content:'Translate',status:'completed',
  created_at:'2026-11-17T00:00:00Z',completed_at:null,attachments:[record()]}]},chat);
 const attachment=chatPresentation(chat,history.messages).messages[0].attachments?.[0];
 assert.equal(attachment?.originalUrl,record().original_url);assert.equal(attachment?.searchable,false);
});

test('manual upload retry reuses its idempotency ID after an ambiguous response',async()=>{
 const batch=new DocumentUploads(()=>id),file=new File(['abc'],'file.png'),ids:string[]=[];
 const input=source({uploadDocument:async(_file,uploadId)=>{ids.push(uploadId);if(ids.length===1)throw Error('Lost response');return record();},document:async()=>record()});
 await assert.rejects(batch.prepare(input,[file],'Translate',new AbortController().signal));
 assert.equal((await batch.prepare(input,[file],'Translate',new AbortController().signal))[0].id,id);
 assert.deepEqual(ids,[id,id]);
});

test('account cancellation during upload cannot dispatch a chat message',async()=>{
 const abort=new AbortController(),batch=new DocumentUploads(()=>id);let reads=0;
 const pending=batch.prepare(source({uploadDocument:async()=>{abort.abort();return record({status:'queued'});},document:async()=>{reads++;return record();}}),[new File(['abc'],'file.png')],'Translate',abort.signal);
 await assert.rejects(pending,(error:unknown)=>error instanceof Error&&error.name==='AbortError');assert.equal(reads,0);
});

test('queued files dispatch without waiting for classification or polling document status',async()=>{
 let sent:string[]|undefined;
 const controller=new LiveWorkspaceController(source({uploadDocument:async()=>record({status:'queued',category:null,coverage:'unknown'}),
  document:async()=>{throw Error('Chat must not poll the worker');},send:async(_content,_id,emit,options)=>{
   sent=options?.documentIds;emit({event:'done',data:{}});
  }}),()=>{},()=>id);
 await controller.load();assert.equal(await controller.send('Сохрани файл',undefined,[new File(['abc'],'file.png')]),true);
 assert.deepEqual(sent,[id]);controller.stop();
});

test('live chat sends stored document IDs and does not convert an excluded attachment into text-only history',async()=>{
 let sent:string[]|undefined;
 const controller=new LiveWorkspaceController(source({uploadDocument:async()=>record(),document:async()=>record(),send:async(_content,_id,emit,options)=>{
  sent=options?.documentIds;emit({event:'delta',data:{text:'Translated'}});emit({event:'done',data:{}});
 }}),()=>{},()=>id);
 await controller.load();assert.equal(await controller.send('Translate',undefined,[new File(['abc'],'file.png')]),true);
 assert.deepEqual(sent,[id]);controller.stop();
});

test('a missing capability prevents upload and preserves the draft for a deliberate retry',async()=>{
 let writes=0;
 const controller=new LiveWorkspaceController(source({capabilities:async()=>({...caps,documents:undefined}),uploadDocument:async()=>{writes++;return record();}}),()=>{},()=>id);
 await controller.load();assert.equal(await controller.send('Translate',undefined,[new File(['abc'],'file.png')]),false);
 assert.equal(writes,0);controller.stop();
});

test('preuploaded attachments dispatch immediately and acknowledge the composer before the assistant finishes',async()=>{
 let finish=()=>{},acknowledged=false,sent:string[]|undefined;
 const controller=new LiveWorkspaceController(source({uploadDocument:async()=>{throw Error('No second upload');},document:async()=>{throw Error('No browser OCR polling');},send:async(_text,_id,emit,options)=>{
  sent=options?.documentIds;options?.onTurn?.(chat);await new Promise<void>(resolve=>{finish=resolve;});emit({event:'done',data:{}});
 }}),()=>{},()=>id);
 await controller.load();const pending=controller.send('Read the guide',()=>{acknowledged=true;},[],[record({status:'staged'})]);
 await new Promise(resolve=>setImmediate(resolve));assert.equal(acknowledged,true);assert.deepEqual(sent,[id]);finish();await pending;controller.stop();
});
