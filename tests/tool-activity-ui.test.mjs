import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {createServer} from 'vite';
const vite=await createServer({mode:'design',server:{middlewareMode:true},appType:'custom'});
after(()=>vite.close());
const {ToolActivityBlock,toolPayloadText}=await vite.ssrLoadModule('/src/components/ToolActivityBlock.tsx');
const {ChatActivityTimeline}=await vite.ssrLoadModule('/src/components/ChatActivityTimeline.tsx');
const {ChatWorkspace}=await vite.ssrLoadModule('/src/components/ChatWorkspace.tsx');
const {createDesignSource}=await vite.ssrLoadModule('/src/demo/source.ts');
const tool={kind:'tool',id:'tool:2',sequence:2,toolKind:'memory_search',title:'Checked memory',status:'success'};
const markup=props=>renderToStaticMarkup(React.createElement(ToolActivityBlock,{activity:tool,...props}));
test('legacy tool starts collapsed, has exact confirmed status/title, no fake duration, payload or Copy',()=>{
 const html=markup({});assert.match(html,/aria-expanded="false"/);assert.match(html,/Checked memory/);assert.match(html,/Success/);
 assert.doesNotMatch(html,/Copy|Input|Output|Running|\d+ ms|call_id/);
 const expanded=markup({defaultExpanded:true});assert.match(expanded,/Input/);assert.match(expanded,/Output/);assert.equal(expanded.match(/Data unavailable/g)?.length,2);assert.doesNotMatch(expanded,/Copy|\{\}/);
});
test('internal presentation slots render escaped JSON/text and explicit truncation, never HTML',()=>{
 const input={format:'json',text:'{"value":"<script>synthetic</script>"}'},output={format:'text',text:'x'.repeat(13000),truncated:true};
 const html=markup({activity:{...tool,input,output,durationMs:128},defaultExpanded:true});
 assert.match(html,/128 ms/);assert.match(html,/Copy tool input/);assert.match(html,/Copy tool output/);
 assert.match(html,/&lt;script&gt;/);assert.doesNotMatch(html,/<script>/);assert.match(html,/Some details are shortened or unavailable/);
 assert.equal(toolPayloadText(input),JSON.stringify(JSON.parse(input.text),null,2));
 assert.match(markup({activity:{...tool,output:{format:'text',text:'x'.repeat(13000)}},defaultExpanded:true}),/Display truncated/);
});
test('interleaved timeline keeps provider segments and puts Thinking only on its current last reasoning segment',()=>{
 const entries=[{kind:'reasoning',id:'r1',sequence:1,turnNumber:1,text:'Before search'},tool,{kind:'reasoning',id:'r3',sequence:3,turnNumber:2,text:'After search'}];
 const html=renderToStaticMarkup(React.createElement(ChatActivityTimeline,{entries,isStreaming:true}));
 assert.ok(html.indexOf('Before search')<html.indexOf('Checked memory'));assert.ok(html.indexOf('Checked memory')<html.indexOf('After search'));
 assert.equal(html.match(/Thinking…/g)?.length,1);assert.equal(html.match(/Checked memory/g)?.length,1);
 const complete=renderToStaticMarkup(React.createElement(ChatActivityTimeline,{entries,isStreaming:false}));assert.doesNotMatch(complete,/Thinking…/);
 const toolLast=renderToStaticMarkup(React.createElement(ChatActivityTimeline,{entries:entries.slice(0,2),isStreaming:true}));assert.doesNotMatch(toolLast,/Thinking…/);
});
const noop=()=>{},account={displayName:'Synthetic',initials:'S',email:'',description:'',timezone:'UTC',spaceDescription:''};
const message={id:'m',sender:'assistant',content:'Accepted final answer',status:'completed',timestamp:'12:00',reasoning:'Before searchAfter search'};
const props={account,memoriesCount:0,conversation:{id:'c',title:'Synthetic',group:'Today',updatedAt:'',relatedMemoryIds:[],messages:[message]},onSendMessage:noop,onCitationClick:noop,onActionClick:noop,addedActionIds:[],isSidebarCollapsed:false,onExpandSidebar:noop,onOpenMobileMenu:noop,isContextPanelOpen:false,onToggleContextPanel:noop,plan:'free',onTogglePlan:noop,onOpenPlanModal:noop,theme:'light',onToggleTheme:noop,onNewChat:noop};
test('chat displays timeline once above final card',()=>{
 const timeline=[{kind:'reasoning',id:'r1',sequence:1,turnNumber:1,text:'Before search'},tool,{kind:'reasoning',id:'r3',sequence:3,turnNumber:2,text:'After search'}];
 const html=renderToStaticMarkup(React.createElement(ChatWorkspace,{...props,conversation:{...props.conversation,messages:[{...message,timeline}]}}));
 assert.equal(html.match(/Before search/g)?.length,1);assert.equal(html.match(/Checked memory/g)?.length,1);assert.equal(html.match(/After search/g)?.length,1);
 assert.doesNotMatch(html,/Before searchAfter search/);assert.ok(html.indexOf('After search')<html.indexOf('Accepted final answer'));
});
test('Design activity data stays offline and unrelated components do not import it',async()=>{
 const old=globalThis.fetch;globalThis.fetch=()=>assert.fail('No requests from Design');
 try{const demo=createDesignSource();await demo.session();await demo.history();await demo.capabilities();}finally{globalThis.fetch=old;}
 for(const path of ['src/components/ModelReasoningBlock.tsx','src/components/Sidebar.tsx','src/components/ConnectionsSettingsView.tsx']){
  assert.doesNotMatch(fs.readFileSync(path,'utf8'),/ToolActivityBlock|ChatActivityTimeline|toolPayloadText/,path);
 }
});

test('expanded null projections have a neutral omission notice, no Copy, and real mapped statuses/duration',()=>{
 const unavailable=markup({activity:{...tool,status:'skipped',truncated:true},defaultExpanded:true});
 assert.match(unavailable,/Not executed/);assert.match(unavailable,/Some details are shortened or unavailable/);
 assert.doesNotMatch(unavailable,/Copy|Running|\d+ ms/);
 const running=markup({activity:{...tool,status:'running',phase:'started'}});
 assert.match(running,/Running/);assert.match(running,/animate-spin/);assert.doesNotMatch(running,/Success/);
 const unknown=markup({activity:{...tool,status:'interrupted',phase:'started'}});
 assert.match(unknown,/Interrupted/);assert.doesNotMatch(unknown,/animate-spin|Success|Failed/);
 const failed=markup({activity:{...tool,title:'Memory change not confirmed',status:'failure',durationMs:0}});
 assert.match(failed,/Memory change not confirmed/);assert.match(failed,/Failed/);assert.match(failed,/0 ms/);assert.doesNotMatch(failed,/Success/);
});

test('failed reasoning/tool chronology is static above unchanged Reply failed diagnostics buttons',()=>{
 const context={turn_id:'00000000-0000-4000-8000-000000000001',request_trace_id:100,report_url:'/api/v1/chat/turns/00000000-0000-4000-8000-000000000001/report/'};
 const failed={...message,status:'failed',content:'Safe server failure',report_context:context,reasoning:'BeforeAfter',timeline:[
  {kind:'reasoning',id:'r1',sequence:1,turnNumber:1,text:'Before'},tool,
  {kind:'reasoning',id:'r3',sequence:3,turnNumber:1,text:'After'},
  {...tool,id:'tool:4',sequence:4,status:'interrupted'},
 ]};
 const diagnostics={forMessage:()=>({available:true,reporting:false,reported:false,copying:false,copied:false}),onCopy:noop,onReport:noop};
 const html=renderToStaticMarkup(React.createElement(ChatWorkspace,{...props,live:true,diagnostics,conversation:{...props.conversation,messages:[failed]}}));
 assert.ok(html.indexOf('Before')<html.indexOf('Checked memory'));assert.ok(html.indexOf('Checked memory')<html.indexOf('After'));
 assert.ok(html.indexOf('After')<html.lastIndexOf('Reply failed'));assert.match(html,/Interrupted/);
 assert.match(html,/Report issue/);assert.match(html,/Copy Error For Admin Diagnostics/);
 assert.doesNotMatch(html,/Thinking…|Generating reasoning|animate-spin|BeforeAfter/);
});
