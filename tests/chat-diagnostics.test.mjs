import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {createServer} from 'vite';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
const vite=await createServer({mode:'design',server:{middlewareMode:true},appType:'custom'});
after(()=>vite.close());
const {ChatDiagnosticsController}=await vite.ssrLoadModule('/src/hooks/useChatDiagnostics.ts');
const {copyDiagnosticText}=await vite.ssrLoadModule('/src/utils/diagnosticsClipboard.ts');
const {ChatWorkspace}=await vite.ssrLoadModule('/src/components/ChatWorkspace.tsx');
const {useDemoWorkspace}=await vite.ssrLoadModule('/src/demo/useDemoWorkspace.ts');
const {WorkspaceView}=await vite.ssrLoadModule('/src/pages/WorkspaceView.tsx');
const {LiveWorkspaceController}=await vite.ssrLoadModule('/src/hooks/LiveWorkspaceController.ts');
const {ApiError,StreamInterruptedError}=await vite.ssrLoadModule('/src/api/errors.ts');
const turn='00000000-0000-4000-8000-000000000001',submission='00000000-0000-4000-8000-000000000002';
const context={turn_id:turn,request_trace_id:100,report_url:'/api/v1/chat/turns/'+turn+'/report/'};
const message={id:'a-message-not-the-turn',sender:'assistant',status:'failed',content:'Synthetic private answer',timestamp:'12:00',report_context:context};
const report=(trace=100)=>'Synthetic server report\nChatTurn: '+turn+'\nRequestTrace: '+trace+'\n';
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
function setup(overrides={},copy=async load=>{await load();}){
 let posts=0,reads=0,csrf=0,expired=0;const notices=[];
 const source={kind:'live',getFullChatErrorReport:async()=>{throw new ApiError(403,'forbidden','Denied');},reportChatIssue:async ctx=>{posts++;return {issue:{id:submission,turn_id:ctx.turn_id,request_trace_id:ctx.request_trace_id,status:'new',created_at:'2026-10-15T10:00:00Z'},created:true};},getChatErrorReport:async()=>{reads++;return report();},refreshCsrf:async()=>{csrf++;return 'synthetic';},send:()=>assert.fail('Diagnostics must never call Agent'),...overrides};
 const c=new ChatDiagnosticsController(source,()=>expired++,text=>notices.push(text),copy);
 return {c,source,notices,counts:()=>({posts,reads,csrf,expired})};
}
test('Sending -> Report sent only after response; double click has one active POST',async()=>{
 const pending=deferred();let posts=0;
 const s=setup({reportChatIssue:()=>{posts++;return pending.promise;}});
 try{const write=s.c.onReport(message);assert.equal(s.c.forMessage(message).reporting,true);assert.equal(s.c.forMessage(message).reported,false);
 await s.c.onReport(message);assert.equal(posts,1);pending.resolve({});await write;
 assert.equal(s.c.forMessage(message).reporting,false);assert.equal(s.c.forMessage(message).reported,true);
 }finally{s.c.stop();}
});
test('each HTTP failure remains unreported, retries preserve the original attempt, and 401 expires',async()=>{
 for(const status of [400,401,403,404,409,503]){
  const captured=[];const s=setup({reportChatIssue:async ctx=>{captured.push({...ctx});throw new ApiError(status,'failure','UNSAFE_ERROR');}});
  try{await s.c.onReport(message);assert.equal(s.c.forMessage(message).reported,false);assert.equal(captured.length,1);
   if(status===401)assert.equal(s.counts().expired,1);
   else{assert.ok(s.notices.length);assert.doesNotMatch(s.notices[0],/UNSAFE_ERROR/);await s.c.onReport(message);assert.equal(captured.length,2);assert.deepEqual(captured[1],context);}
   if(status===403)assert.equal(s.counts().csrf,1);
  }finally{s.c.stop();}
 }
});
test('immutable attempt snapshot survives Retry/changed message context; late success never reports the new trace',async()=>{
 const pending=deferred(),captured=[];const s=setup({reportChatIssue:ctx=>{captured.push({...ctx});return pending.promise;}});
 const input={...message,report_context:{...context}};
 try{
  const write=s.c.onReport(input);input.report_context.request_trace_id=101;
  assert.equal(s.c.forMessage(input).reported,false);assert.equal(s.c.forMessage(input).reporting,false);
  pending.resolve({});await write;assert.equal(s.c.forMessage(input).reported,false);assert.equal(s.c.forMessage(message).reported,true);assert.equal(captured[0].request_trace_id,100);
 }finally{s.c.stop();}
});
test('ambiguous POST retries the exact original pair without an Agent call; 409 never redirects',async()=>{
 let attempts=0;const captured=[];const s=setup({reportChatIssue:async ctx=>{captured.push({...ctx});if(++attempts===1)throw new TypeError('Lost connection');return {};}});
 try{await s.c.onReport(message);assert.equal(captured.length,1);assert.equal(s.c.forMessage(message).reported,false);
 await s.c.onReport(message);assert.deepEqual(captured,[context,context]);assert.equal(s.c.forMessage(message).reported,true);
 const another=setup();assert.equal(another.c.forMessage(message).reported,false);another.c.stop();
 }finally{s.c.stop();}
});
test('invalid/missing/non-failed/user context disables both actions without requests',async()=>{
 const s=setup();
 try{for(const m of [{...message,report_context:undefined},{...message,report_context:{...context,request_trace_id:1.1}},{...message,status:'completed'},{...message,sender:'user'}]){
  assert.equal(s.c.forMessage(m).available,false);await s.c.onReport(m);await s.c.onCopy(m);
 }assert.deepEqual(s.counts(),{posts:0,reads:0,csrf:0,expired:0});}finally{s.c.stop();}
});
test('logout/account replacement aborts requests, clears flags and ignores a late response',async()=>{
 let signal;const pending=deferred(),s=setup({reportChatIssue:(_ctx,sig)=>{signal=sig;return pending.promise;}});
 const write=s.c.onReport(message);s.c.stop();assert.equal(signal.aborted,true);
 const other=setup();pending.resolve({});await write;
 assert.equal(s.c.forMessage(message).reported,false);assert.equal(other.c.forMessage(message).reported,false);assert.deepEqual(s.notices,[]);other.c.stop();
});
test('Copy writes only server text and shows copied only after Clipboard resolves',async()=>{
 const clipboard=deferred(),loaded=deferred();let copied='';
 const s=setup({},async(load,current)=>{copied=await load();loaded.resolve();assert.equal(current(),true);await clipboard.promise;});
 try{const copy=s.c.onCopy(message);assert.equal(s.c.forMessage(message).copying,true);assert.equal(s.c.forMessage(message).copied,false);
 await loaded.promise;assert.equal(copied,report());assert.doesNotMatch(copied,/Synthetic private answer|user_agent|conversation_id/);
 clipboard.resolve();await copy;assert.equal(s.c.forMessage(message).copied,true);assert.equal(s.c.forMessage(message).copying,false);
 }finally{s.c.stop();}
});
test('GET/Clipboard rejection and 404 never show copied or synthesize a substitute',async()=>{
 for(const status of [401,404,503]){
  let writes=0;const s=setup({getChatErrorReport:async()=>{throw new ApiError(status,'not_found','no');}},async load=>{await load();writes++;});
  await s.c.onCopy(message);assert.equal(writes,0);assert.equal(s.c.forMessage(message).copied,false);s.c.stop();
 }
 const denied=setup({},async()=>{throw new DOMException('Denied','NotAllowedError');});
 await denied.c.onCopy(message);assert.equal(denied.c.forMessage(message).copied,false);assert.ok(denied.notices.length);denied.c.stop();
});
test('Copy rejects another trace of a reused turn and cancels pending text after logout',async()=>{
 let writes=0;const mismatch=setup({getChatErrorReport:async()=>report(101)},async load=>{await load();writes++;});
 await mismatch.c.onCopy(message);assert.equal(writes,0);assert.equal(mismatch.c.forMessage(message).copied,false);assert.match(mismatch.notices[0],/changed/);mismatch.c.stop();
 const pending=deferred(),cancelled=setup({getChatErrorReport:()=>pending.promise},async(load,current)=>{await load();if(current())writes++;});
 const copy=cancelled.c.onCopy(message);cancelled.c.stop();pending.resolve(report());await copy;assert.equal(writes,0);assert.equal(cancelled.c.forMessage(message).copied,false);assert.deepEqual(cancelled.notices,[]);
});
function clipboardGlobals(clipboard,Item){
 const nav=Object.getOwnPropertyDescriptor(globalThis,'navigator'),item=Object.getOwnPropertyDescriptor(globalThis,'ClipboardItem');
 Object.defineProperty(globalThis,'navigator',{configurable:true,value:{clipboard}});
 Object.defineProperty(globalThis,'ClipboardItem',{configurable:true,value:Item});
 return ()=>{if(nav)Object.defineProperty(globalThis,'navigator',nav);else delete globalThis.navigator;if(item)Object.defineProperty(globalThis,'ClipboardItem',item);else delete globalThis.ClipboardItem;};
}
test('promise ClipboardItem write starts synchronously before async fetch; only resolved text/plain Blob is written',async()=>{
 const events=[],pending=deferred();let types;
 const restore=clipboardGlobals({write(items){events.push('write');types=items[0].data;return pending.promise;}},class{constructor(data){this.data=data;}});
 try{
  const operation=copyDiagnosticText(async()=>{events.push('get');return report();});
  assert.deepEqual(events,['write']);await Promise.resolve();assert.deepEqual(events,['write','get']);
  assert.equal(await (await types['text/plain']).text(),report());assert.deepEqual(Object.keys(types),['text/plain']);pending.resolve();await operation;
 }finally{restore();}
});
test('clipboard unavailable/denied, promise-data rejection and writeText fallback have no false success or loops',async()=>{
 let loads=0,writes=0;
 for(const clipboard of [undefined,{}]){
  const restore=clipboardGlobals(clipboard,undefined);
  try{await assert.rejects(copyDiagnosticText(async()=>{loads++;return report();}));}finally{restore();}
 }
 assert.equal(loads,0);
 let restore=clipboardGlobals({writeText:async text=>{writes++;assert.equal(text,report());}},undefined);
 try{await copyDiagnosticText(async()=>report());assert.equal(writes,1);}finally{restore();}
 restore=clipboardGlobals({write:async()=>{writes++;throw new DOMException('Denied','NotAllowedError');},writeText:async()=>assert.fail('No automatic fallback after denial')},class{constructor(data){this.data=data;}});
 try{await assert.rejects(copyDiagnosticText(async()=>report()));assert.equal(writes,2);}finally{restore();}
 restore=clipboardGlobals({write:async items=>{await items[0].data['text/plain'];}},class{constructor(data){this.data=data;}});
 try{await assert.rejects(copyDiagnosticText(async()=>{throw new Error('404');}),/404/);}finally{restore();}
});
test('history/SSE/turn recovery preserve authoritative attempt context without changing submission IDs',async()=>{
 let reads=0;const caps={api_version:'v1',chat:true,memory_read:false};
 const source={kind:'live',capabilities:async()=>caps,history:async()=>{if(++reads>1)throw new ApiError(503,'offline','Offline');return {conversation_id:'synthetic',messages:[],next_before:null};},
  send:async(_text,id,event,options)=>{assert.equal(id,submission);options.onTurn(turn);event({event:'trace',data:{turn_status:'failed',assistant_content:'Server failure',report_context:context}});throw new StreamInterruptedError();},
  turn:async id=>{assert.equal(id,turn);return {turn_status:'failed',assistant_content:'Server failure after retry',report_context:{...context,request_trace_id:101},events:[],summary:''};}};
 const c=new LiveWorkspaceController(source,()=>{},()=>submission);
 await c.load();await c.send('Synthetic');assert.deepEqual(c.snapshot().history.messages.at(-1).report_context,context);assert.equal(c.snapshot().history.messages.at(-1).id,'reply:'+submission);
 await c.recover();assert.equal(c.snapshot().history.messages.at(-1).report_context.request_trace_id,101);c.stop();
});
const noop=()=>{};
const account={displayName:'Synthetic account',initials:'SA',email:'',description:'',timezone:'UTC',spaceDescription:'Personal space'};
const props={account,memoriesCount:0,conversation:{id:'synthetic',title:'Synthetic',group:'Today',updatedAt:'',relatedMemoryIds:[],messages:[message]},onSendMessage:noop,onCitationClick:noop,onActionClick:noop,addedActionIds:[],isSidebarCollapsed:false,onExpandSidebar:noop,onOpenMobileMenu:noop,isContextPanelOpen:false,onToggleContextPanel:noop,plan:'free',onTogglePlan:noop,onOpenPlanModal:noop,theme:'light',onToggleTheme:noop,onNewChat:noop};
const markup=extra=>renderToStaticMarkup(React.createElement(ChatWorkspace,{...props,...extra}));
test('existing Studio buttons/classes/icons/layout are preserved against current main for failed messages',async()=>{
 fs.mkdirSync('.review-baseline/diagnostics-main',{recursive:true});
 const archive=execFileSync('git',['archive','7344679c7ba338e5f6298ed89bd20e40394b6ded','src'],{maxBuffer:32*1024*1024});execFileSync('tar',['-xf','-','-C','.review-baseline/diagnostics-main'],{input:archive});
 const {ChatWorkspace:Studio}=await vite.ssrLoadModule('/.review-baseline/diagnostics-main/src/components/ChatWorkspace.tsx');
 const s=setup();
 try{
  const expected=renderToStaticMarkup(React.createElement(Studio,props));
  assert.equal(markup({diagnostics:s.c}),expected);
  assert.equal(markup({live:true,diagnostics:s.c}),renderToStaticMarkup(React.createElement(Studio,{...props,live:true})));
  const html=markup({live:true,diagnostics:s.c,isAdmin:false});assert.match(html,/Copy Error For Admin Diagnostics/);
 }finally{s.c.stop();}
});
test('only existing UI states are used, invalid context disables actions, and callback payload is the failed message',async()=>{
 const pending=deferred(),s=setup({reportChatIssue:()=>pending.promise});
 try{
  const write=s.c.onReport(message);const sending=markup({live:true,diagnostics:s.c});assert.match(sending,/Sending report…/);assert.doesNotMatch(sending,/Report sent/);
  pending.resolve({});await write;assert.match(markup({live:true,diagnostics:s.c}),/Report sent/);
  const invalid=markup({live:true});assert.match(invalid,/disabled="" aria-label="Report issue to backend"/);assert.match(invalid,/Copy Error For Admin Diagnostics/);assert.doesNotMatch(invalid,/Report sent|Diagnostics copied!/);
  const code=fs.readFileSync('src/components/ChatWorkspace.tsx','utf8');
  assert.doesNotMatch(code,/errorDiagnostics|timestamp_iso|navigator.userAgent|setReportingMessageId|setReportedMessageIds|setCopiedDiagnosticsId/);
  assert.match(code,/handleReportIssue\(msg\)/);assert.match(code,/handleCopyAdminDiagnostics\(msg\)/);
 }finally{s.c.stop();}
});
test('Design diagnostics remain offline, share the same buttons, and cannot call a live source',()=>{
 const fetch=globalThis.fetch;globalThis.fetch=()=>assert.fail('No Design requests');
 try{
  function Design(){const model=useDemoWorkspace();assert.ok(model.diagnostics);return React.createElement(WorkspaceView,{model:{...model,activeConversation:props.conversation,activeSection:'chat'}});}
  const html=renderToStaticMarkup(React.createElement(Design));assert.match(html,/Report issue/);assert.match(html,/Copy Error For Admin Diagnostics/);assert.doesNotMatch(html,/disabled="" aria-label="Report issue to backend"/);
 }finally{globalThis.fetch=fetch;}
});

test('partial delta followed by failed trace/error retains context when history refresh fails',async()=>{
 let reads=0;
 const source={kind:'live',capabilities:async()=>({api_version:'v1',chat:true,memory_read:false}),history:async()=>{if(++reads>1)throw new ApiError(503,'offline','Offline');return {conversation_id:'synthetic',messages:[],next_before:null};},
 send:async(_text,_id,event,options)=>{options.onTurn(turn);event({event:'delta',data:{text:'Partial answer'}});event({event:'trace',data:{turn_status:'failed',assistant_content:'Server failure',report_context:context}});event({event:'error',data:{message:'Failed'}});throw new ApiError(502,'chat_failed','Failed');}};
 const c=new LiveWorkspaceController(source,()=>{},()=>submission);
 await c.load();await c.send('Synthetic');
 const last=c.snapshot().history.messages.at(-1);assert.equal(last.status,'failed');assert.equal(last.content,'Server failure');assert.deepEqual(last.report_context,context);c.stop();
});

test('failed turn recovery before any delta reconstructs only the current server-backed reply slot',async()=>{
 let reads=0;
 const c=new LiveWorkspaceController({kind:'live',capabilities:async()=>({api_version:'v1',chat:true,memory_read:false}),history:async()=>{if(++reads>1)throw new ApiError(503,'offline','Offline');return {conversation_id:'synthetic',messages:[],next_before:null};},
 send:async(_text,_id,_event,options)=>{options.onTurn(turn);throw new StreamInterruptedError();},
 turn:async()=>({turn_status:'failed',assistant_content:'Recovered server failure',report_context:context,events:[],summary:''})},()=>{},()=>submission);
 await c.load();await c.send('Synthetic');assert.equal(c.snapshot().history.messages.length,1);await c.recover();
 assert.equal(c.snapshot().history.messages.length,2);const last=c.snapshot().history.messages.at(-1);assert.equal(last.id,'reply:'+submission);assert.equal(last.content,'Recovered server failure');assert.deepEqual(last.report_context,context);c.stop();
});
test('authoritative history replaces transient context rather than borrowing another attempt',async()=>{
 let reads=0;
 const c=new LiveWorkspaceController({kind:'live',capabilities:async()=>({api_version:'v1',chat:true,memory_read:false}),history:async()=>({conversation_id:'synthetic',messages:++reads===1?[]:[{id:'canonical',sequence:2,role:'assistant',status:'failed',content:'Canonical',created_at:'2026-10-15T10:00:00Z',completed_at:null}],next_before:null}),
 send:async(_text,_id,event,options)=>{options.onTurn(turn);event({event:'trace',data:{turn_status:'failed',assistant_content:'Transient',report_context:context}});throw new ApiError(502,'chat_failed','Failed');}},()=>{},()=>submission);
 await c.load();await c.send('Synthetic');const last=c.snapshot().history.messages.at(-1);assert.equal(last.id,'canonical');assert.equal(last.report_context,undefined);c.stop();
});

const fullReport=(trace=100,id=turn,payload='Synthetic Unicode: Привет 😀\r\n')=>
 ['BEGIN MROYA ERROR REPORT','# Mroya Error Report','Report ID: synthetic','','## Metadata','````json',
 JSON.stringify({trace_id:trace,chat_turn_id:id,note:'```'},null,2),'````','','## User message','```json',JSON.stringify(payload),'```','','END MROYA ERROR REPORT'].join('\n');
test('full authorized Copy preserves large original text, immutable attempt and single-flight until native completion',async()=>{
 const pending=deferred(),clipboard=deferred(),loaded=deferred();let reads=0,writes=0,copied;
 const s=setup({getFullChatErrorReport:async(id)=>{assert.equal(id,turn);reads++;return pending.promise;},getChatErrorReport:()=>assert.fail('No short fallback')},
 async load=>{copied=await load();writes++;loaded.resolve();await clipboard.promise;});
 const input={...message,report_context:{...context}};
 try{
  const work=s.c.onCopy(input);assert.equal(s.c.forMessage(message).copying,true);
  await s.c.onCopy(input);assert.equal(reads,1);input.report_context.request_trace_id=101;
  const text=fullReport(100,turn,'Ж😀'.repeat(220000));assert.ok(Buffer.byteLength(text)>1024*1024);
  pending.resolve(text);await loaded.promise;assert.equal(copied,text);assert.equal(writes,1);
  assert.equal(s.c.forMessage(message).copied,false);clipboard.resolve();await work;
  assert.equal(s.c.forMessage(message).copied,true);assert.equal(s.c.forMessage(input).copied,false);
 }finally{s.c.stop();}
});
test('only exact full 403 forbidden falls back, in order, without setting CSRF refresh for the next Report',async()=>{
 const events=[];let csrf=0,written;
 const s=setup({getFullChatErrorReport:async()=>{events.push('full');throw new ApiError(403,'forbidden','Denied');},
 getChatErrorReport:async()=>{events.push('short');return report();},refreshCsrf:async()=>{csrf++;}},
 async load=>{written=await load();events.push('write');});
 try{await s.c.onCopy(message);assert.deepEqual(events,['full','short','write']);assert.equal(written,report());
 await s.c.onReport(message);assert.equal(csrf,0);assert.equal(s.c.forMessage(message).reported,true);
 }finally{s.c.stop();}
});
test('full errors never fall back or copy; 401 expires and short fallback 404 remains unsuccessful',async()=>{
 const errors=[new ApiError(401,'authentication_required','No'),new ApiError(404,'not_found','No'),
 new ApiError(403,'csrf_failed','No'),new ApiError(503,'unavailable','No'),
 new ApiError(502,'invalid_response','MIME'),new TypeError('network'),new DOMException('Timeout','TimeoutError')];
 for(const error of errors){
  let short=0,writes=0;const s=setup({getFullChatErrorReport:async()=>{throw error;},getChatErrorReport:async()=>{short++;return report();}},
  async load=>{await load();writes++;});
  try{await s.c.onCopy(message);assert.equal(short,0);assert.equal(writes,0);assert.equal(s.c.forMessage(message).copied,false);
   assert.equal(s.counts().expired,error.status===401?1:0);
  }finally{s.c.stop();}
 }
 let writes=0;const s=setup({getChatErrorReport:async()=>{throw new ApiError(404,'not_found','No');}},async load=>{await load();writes++;});
 try{await s.c.onCopy(message);assert.equal(writes,0);assert.equal(s.c.forMessage(message).copied,false);}finally{s.c.stop();}
});
test('full Metadata must be the canonical first section and match original turn/trace; spoofed user text cannot substitute',async()=>{
 const good=fullReport();
 const invalid=[fullReport(101),fullReport(100,submission),good.replace('## Metadata','## Missing'),
 good.replace('"trace_id": 100','"trace_id": "100"'),good.replace('"trace_id": 100','broken JSON'),
 good.replace('END MROYA ERROR REPORT',''),good.replace('BEGIN MROYA ERROR REPORT','wrong'),
 good.replace('## Metadata','## User message')+'\n## Metadata\n```json\n'+JSON.stringify({trace_id:100,chat_turn_id:turn})+'\n```\nEND MROYA ERROR REPORT',
 fullReport(101,turn,'## Metadata\n```json\n'+JSON.stringify({trace_id:100,chat_turn_id:turn})+'\n```'),
 good.replace('## Metadata\n````json','## Metadata\n```json')];
 for(const text of invalid){
  let writes=0;const s=setup({getFullChatErrorReport:async()=>text,getChatErrorReport:()=>assert.fail('No fallback')},async load=>{await load();writes++;});
  try{await s.c.onCopy(message);assert.equal(writes,0);assert.equal(s.c.forMessage(message).copied,false);}finally{s.c.stop();}
 }
});
test('logout cancels a pending full response or fallback without clipboard writes or stale notices',async()=>{
 for(const fallback of [false,true]){
  const pending=deferred();let signal,writes=0,short=0;
  const s=setup({getFullChatErrorReport:(_id,sig)=>{signal=sig;return pending.promise;},getChatErrorReport:async()=>{short++;return report();}},
  async load=>{await load();writes++;});
  const work=s.c.onCopy(message);s.c.stop();s.c.start();
  if(fallback)pending.reject(new ApiError(403,'forbidden','No'));else pending.resolve(fullReport());
  await work;assert.equal(signal.aborted,true);assert.equal(short,0);assert.equal(writes,0);assert.deepEqual(s.notices,[]);
  assert.equal(s.c.forMessage(message).copied,false);s.c.stop();
 }
});
test('full clipboard rejection never falls back and never confirms success',async()=>{
 let short=0;const s=setup({getFullChatErrorReport:async()=>fullReport(),getChatErrorReport:async()=>{short++;return report();}},
 async load=>{await load();throw new DOMException('Denied','NotAllowedError');});
 try{await s.c.onCopy(message);assert.equal(short,0);assert.equal(s.c.forMessage(message).copied,false);assert.ok(s.notices.length);}finally{s.c.stop();}
});
