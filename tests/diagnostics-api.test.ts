import test from 'node:test';
import assert from 'node:assert/strict';
import {MroyaApi} from '../src/api/client.ts';
import {ApiError} from '../src/api/errors.ts';
import {readReportContext} from '../src/api/reportContext.ts';
import {createLiveSource} from '../src/providers/liveSource.ts';
import {chatPresentation} from '../src/hooks/liveAdapters.ts';
const turn='00000000-0000-4000-8000-000000000001',other='00000000-0000-4000-8000-000000000002';
const context={turn_id:turn,request_trace_id:100,report_url:'/api/v1/chat/turns/'+turn+'/report/'};
const json=(value:unknown,status=200)=>new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json'}});
const result=(created=true)=>({issue:{id:other,turn_id:turn,request_trace_id:100,status:'new',created_at:'2026-10-15T10:00:00Z'},created});
function fetcher(fn:(url:string,init:RequestInit)=>Response|Promise<Response>):typeof fetch{return ((url,init={})=>Promise.resolve(fn(String(url),init))) as typeof fetch;}
test('authoritative report context validation rejects absent, fabricated paths and unsafe trace IDs',()=>{
 assert.deepEqual(readReportContext(context),context);assert.notEqual(readReportContext(context),context);
 for(const value of [null,undefined,[],{}, {...context,turn_id:'bad'},...[-1,0,1.1,Number.MAX_SAFE_INTEGER+1,'100',true].map(request_trace_id=>({...context,request_trace_id})),...['https://app.heymroya.com'+context.report_url,'//foreign.test/report/','/admin/','/api/v1/chat/turns/'+other+'/report/',context.report_url+'?trace=100'].map(report_url=>({...context,report_url}))])assert.equal(readReportContext(value),undefined);
});
test('Report POST uses exact body, same-origin session, CSRF and validated 201/200 confirmations',async()=>{
 for(const created of [true,false]){
  const calls:{url:string;init:RequestInit}[]=[],abort=new AbortController();
  const api=new MroyaApi(fetcher((url,init)=>{calls.push({url,init});return url.endsWith('csrf/')?json({csrf_token:'synthetic'}):json({...result(created),issue:{...result(created).issue,status:created?'new':'resolved'}},created?201:200);}));
  const source=createLiveSource(api);const response=await source.reportChatIssue!(context,abort.signal);
  assert.equal(response.created,created);assert.equal(response.issue.status,created?'new':'resolved');
  assert.equal(calls[1].url,context.report_url);assert.equal(calls[1].init.method,'POST');assert.equal(calls[1].init.body,'{"request_trace_id":100}');
  assert.equal((calls[1].init.headers as Record<string,string>)['X-CSRFToken'],'synthetic');
  for(const c of calls){assert.equal(c.init.credentials,'same-origin');assert.equal(c.init.cache,'no-store');assert.equal(c.init.redirect,'error');assert.equal(c.init.signal,abort.signal);}
 }
});
test('Report failures never replay a POST or switch its target/trace',async()=>{
 for(const status of [400,401,403,404,405,409,413,503]){
  let writes=0;const urls:string[]=[];
  const api=new MroyaApi(fetcher((url,init)=>{urls.push(url);if(url.endsWith('csrf/'))return json({csrf_token:'synthetic'});writes++;assert.equal(init.body,'{"request_trace_id":100}');return json({error:{code:'synthetic_failure'}},status);}));
  await assert.rejects(api.reportChatIssue(context),(error:unknown)=>error instanceof ApiError&&error.status===status);assert.equal(writes,1);assert.equal(urls.at(-1),context.report_url);
 }
 let requests=0;await assert.rejects(new MroyaApi(fetcher(()=>{requests++;return json({});})).reportChatIssue({...context,request_trace_id:0}),ApiError);assert.equal(requests,0);
});
test('Report success requires valid HTTP status, JSON, exact attempt, issue UUID/status/date and created flag',async()=>{
 const invalid=[null,[],{}, {...result(),created:false},{...result(),created:'true'},...[
  {id:'bad'},{turn_id:other},{request_trace_id:101},{status:'unknown'},{created_at:'bad'},{created_at:'2026'},{request_trace_id:100.1}
 ].map(patch=>({...result(),issue:{...result().issue,...patch}}))];
 for(const value of invalid){
  const api=new MroyaApi(fetcher(url=>url.endsWith('csrf/')?json({csrf_token:'s'}):json(value,201)));
  await assert.rejects(api.reportChatIssue(context),(e:unknown)=>e instanceof ApiError&&e.code==='invalid_response');
 }
 for(const response of [json(result(),202),new Response('<html/>',{headers:{'Content-Type':'text/html'}}),new Response('{broken',{headers:{'Content-Type':'application/json'}})]){
  const api=new MroyaApi(fetcher(url=>url.endsWith('csrf/')?json({csrf_token:'s'}):response));
  await assert.rejects(api.reportChatIssue(context),(e:unknown)=>e instanceof ApiError&&e.code==='invalid_response');
 }
});
test('Copy GET returns only bounded server text without parsing JSON, CSRF or private/Admin requests',async()=>{
 const text='Synthetic server report\nChatTurn: '+turn+'\nRequestTrace: 100\n',calls:{url:string;init:RequestInit}[]=[],abort=new AbortController();
 const api=new MroyaApi(fetcher((url,init)=>{calls.push({url,init});return new Response(text,{headers:{'Content-Type':'text/plain; charset=utf-8'}});}));
 assert.equal(await createLiveSource(api).getChatErrorReport!(turn,abort.signal),text);assert.equal(calls.length,1);
 assert.equal(calls[0].url,'/api/v1/chat/turns/'+turn+'/error/');assert.equal(calls[0].init.method,'GET');assert.equal(calls[0].init.credentials,'same-origin');assert.equal(calls[0].init.cache,'no-store');assert.equal(calls[0].init.redirect,'error');assert.equal(calls[0].init.signal,abort.signal);
 assert.deepEqual(calls[0].init.headers,{Accept:'text/plain'});
});
test('Copy rejects wrong MIME/status, unavailable reports, oversized headers/streams, empty text and abort',async()=>{
 for(const response of [
  new Response('html',{headers:{'Content-Type':'text/html'}}),json({error:'not text'}),new Response('',{headers:{'Content-Type':'text/plain'}}),
  new Response('x',{headers:{'Content-Type':'text/plain','Content-Length':'20000'}}),
  new Response('x'.repeat(16385),{headers:{'Content-Type':'text/plain'}}),
  new Response('text',{status:201,headers:{'Content-Type':'text/plain'}}),json({error:{code:'not_found'}},404)
 ]){
  await assert.rejects(new MroyaApi(fetcher(()=>response)).getChatErrorReport(turn));
 }
 const abort=new AbortController();abort.abort();
 await assert.rejects(new MroyaApi(fetcher(()=>new Response('text',{headers:{'Content-Type':'text/plain'}}))).getChatErrorReport(turn,abort.signal),{name:'AbortError'});
});
test('failed history context survives transport/adapter/reload without being included in content',async()=>{
 const api=new MroyaApi(fetcher(()=>json({conversation_id:other,messages:[{id:other,sequence:2,role:'assistant',status:'failed',content:'Synthetic answer',created_at:'2026-10-15T10:00:00Z',completed_at:null,report_context:context}],next_before:null})));
 for(let reload=0;reload<2;reload++){
  const history=await api.history(),message=chatPresentation(history.conversation_id,history.messages).messages[0];
  assert.deepEqual(message.report_context,context);assert.equal(message.id,other);assert.equal(message.content,'Synthetic answer');assert.equal(message.sender,'assistant');assert.equal(message.status,'failed');
 }
});

test('Full GET reuses source/session fetcher and preserves status/code without CSRF or extra identifiers',async()=>{
 const abort=new AbortController(),calls:{url:string;init:RequestInit}[]=[];
 const api=new MroyaApi(fetcher((url,init)=>{calls.push({url,init});return new Response('Synthetic full',{headers:{'Content-Type':'text/plain; charset=utf-8'}});}));
 assert.equal(await createLiveSource(api).getFullChatErrorReport!(turn,abort.signal),'Synthetic full');
 assert.equal(calls.length,1);assert.equal(calls[0].url,'/api/v1/chat/turns/'+turn+'/error/full/');
 assert.deepEqual(calls[0].init,{method:'GET',credentials:'same-origin',cache:'no-store',redirect:'error',signal:abort.signal,headers:{Accept:'text/plain'}});
 for(const [status,code] of [[401,'authentication_required'],[403,'forbidden'],[403,'csrf_failed'],[404,'not_found'],[503,'unavailable']] as const){
  await assert.rejects(new MroyaApi(fetcher(()=>json({error:{code}},status))).getFullChatErrorReport(turn),(e:unknown)=>e instanceof ApiError&&e.status===status&&e.code===code);
 }
 let count=0;await assert.rejects(new MroyaApi(fetcher(()=>{count++;return json({});})).getFullChatErrorReport('bad'));assert.equal(count,0);
});
function streamed(chunks:Uint8Array[],failure=false,headers:Record<string,string>={}){
 let index=0;
 return new Response(new ReadableStream<Uint8Array>({pull(controller){
  if(index<chunks.length)controller.enqueue(chunks[index++]);
  else if(failure)controller.error(new Error('Synthetic interrupted stream'));
  else controller.close();
 }}),{headers:{'Content-Type':'text/plain',...headers}});
}
test('Full text over 123 KiB and 1 MiB preserves every UTF-8 byte, emoji, CRLF and split codepoints',async()=>{
 for(const repeats of [25000,220000]){
  const text='BEGIN MROYA ERROR REPORT\r\n'+ 'Я😀\n'.repeat(repeats)+'END MROYA ERROR REPORT',bytes=new TextEncoder().encode(text);
  assert.ok(bytes.byteLength>123*1024);if(repeats===220000)assert.ok(bytes.byteLength>1024*1024);
  const chunks=[bytes.slice(0,29),bytes.slice(29,31),bytes.slice(31,32),bytes.slice(32,33),bytes.slice(33)];
  const api=new MroyaApi(fetcher(()=>streamed(chunks)));
  assert.equal(await api.getFullChatErrorReport(turn),text);
 }
 // Explicitly split a four-byte emoji and a two-byte Cyrillic character.
 const bytes=new TextEncoder().encode('😀Я');
 assert.equal(await new MroyaApi(fetcher(()=>streamed(Array.from(bytes,b=>new Uint8Array([b]))))).getFullChatErrorReport(turn),'😀Я');
});
test('Full 8 MiB limit counts streamed bytes despite missing/false Content-Length and cancels rejected streams',async()=>{
 const limit=8*1024*1024;
 assert.equal((await new MroyaApi(fetcher(()=>new Response('x'.repeat(limit),{headers:{'Content-Type':'text/plain'}}))).getFullChatErrorReport(turn)).length,limit);
 for(const headers of [{},{'Content-Length':'1'}] as Record<string,string>[]){
  let cancelled=false;
  const response=new Response(new ReadableStream<Uint8Array>({
   start(c){c.enqueue(new Uint8Array(limit+1));},cancel(){cancelled=true;}
  }),{headers:{'Content-Type':'text/plain',...headers}});
  await assert.rejects(new MroyaApi(fetcher(()=>response)).getFullChatErrorReport(turn));
  assert.equal(cancelled,true);
 }
 await assert.rejects(new MroyaApi(fetcher(()=>new Response('x',{headers:{'Content-Type':'text/plain','Content-Length':String(limit+1)}}))).getFullChatErrorReport(turn));
 // Byte length, not JS string length: each Cyrillic character takes two bytes.
 await assert.rejects(new MroyaApi(fetcher(()=>new Response('Ж'.repeat(limit/2+1),{headers:{'Content-Type':'text/plain'}}))).getFullChatErrorReport(turn));
});
test('Full never returns partial text after invalid UTF-8, interrupted stream, abort, wrong MIME or non-200',async()=>{
 const encode=(s:string)=>new TextEncoder().encode(s);
 for(const response of [
 streamed([encode('prefix'),new Uint8Array([0xf0,0x9f])]),streamed([encode('prefix'),new Uint8Array([0xff])]),
 streamed([encode('prefix')],true),new Response('html',{headers:{'Content-Type':'text/html'}}),
 new Response('text',{status:201,headers:{'Content-Type':'text/plain'}}),new Response('',{headers:{'Content-Type':'text/plain'}})
 ])await assert.rejects(new MroyaApi(fetcher(()=>response)).getFullChatErrorReport(turn));
 const abort=new AbortController();
 const response=new Response(new ReadableStream<Uint8Array>({start(c){c.enqueue(encode('prefix'));abort.abort();c.close();}}),{headers:{'Content-Type':'text/plain'}});
 await assert.rejects(new MroyaApi(fetcher(()=>response)).getFullChatErrorReport(turn,abort.signal),{name:'AbortError'});
 await assert.rejects(new MroyaApi(fetcher(()=>{throw new TypeError('network');})).getFullChatErrorReport(turn));
 // Short reader still rejects the same payload accepted by full.
 await assert.rejects(new MroyaApi(fetcher(()=>new Response('x'.repeat(16385),{headers:{'Content-Type':'text/plain'}}))).getChatErrorReport(turn));
});
