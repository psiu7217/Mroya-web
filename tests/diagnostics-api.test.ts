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
