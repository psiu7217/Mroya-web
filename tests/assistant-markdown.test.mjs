import test, {after} from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {createServer} from 'vite';
import fs from 'node:fs';

const vite = await createServer({mode:'design',server:{middlewareMode:true},appType:'custom'});
after(()=>vite.close());
const {AssistantMarkdown,assistantUrlTransform}=await vite.ssrLoadModule('/src/components/AssistantMarkdown.tsx');
const {ChatWorkspace}=await vite.ssrLoadModule('/src/components/ChatWorkspace.tsx');
const {chatPresentation}=await vite.ssrLoadModule('/src/hooks/liveAdapters.ts');
const render=(content,variant)=>renderToStaticMarkup(React.createElement(AssistantMarkdown,{content,variant}));
export const sample = '# Заголовок\n\n## English heading\n\n### Three\n#### Four\n##### Five\n###### Six\n\n**bold and *italic***, ~~gone~~ and `inline`.\nNext line\n\n1. First\n2. Second\n   - Nested\n     - Deep\n\n> Quote\n\n---\n\n```js\n  const x = 1;\n    console.log(x);\n```\n\n| One | Two | Three | Four | Five |\n| :-- | --: | :--: | -- | -- |\n| A | B | C | D | E |\n\n[HTTPS](https://example.com/path) and [relative](/help)\n\n![No remote image](https://example.com/tracker.png)';

test('CommonMark, GFM and soft breaks render bilingual block/inline elements',()=>{
 const html=render(sample);
 for(const tag of ['h1','h2','h3','h4','h5','h6','strong','em','del','ol','ul','blockquote','pre','code','table','thead','tbody','hr','br']) assert.match(html,new RegExp('<'+tag+'[ >/]'));
 assert.match(html,/<strong>bold and <em>italic<\/em><\/strong>/);
 assert.equal((html.match(/<th[ >]/g)||[]).length,5);
 assert.match(html,/  const x = 1;\n    console.log\(x\);/);
 assert.match(html,/role="region" aria-label="Message table" tabindex="0"/);
 assert.match(html,/target="_blank" rel="noopener noreferrer"/);
 assert.ok(!html.includes('<img'));assert.match(html,/No remote image/);
});
test('empty/plain/malformed and long strings remain safe',()=>{
 assert.match(render(''),/class="mroya-markdown/);
 assert.match(render('Plain русский text'),/<p>Plain русский text<\/p>/);
 for(const input of ['**unfinished [link]((', 'a'.repeat(16000), 'https://example.com/'+ 'x'.repeat(2000)]) assert.ok(render(input).length>0);
});
test('HTML, scripts, handlers, iframe and JSX are never executable elements',()=>{
 for(const variant of ['assistant','user']) {
 const html=render('<script>alert(1)</script>\n\n<img src=x onerror=alert(1)>\n\n<iframe src="https://evil.test"></iframe>\n\n<div onclick="alert(1)">hello</div>\n\n<CustomComponent />',variant);
 assert.doesNotMatch(html,/<(?:script|img|iframe|div onclick|CustomComponent)\b|onerror=|onclick=/i);
 }
});
test('dangerous, encoded and obscured schemes cannot become clickable links',()=>{
 for(const url of ['javascript:alert(1)','data:text/html,evil','vbscript:msgbox(1)','java script:evil','java\tscript:evil','java\nscript:evil','javascript%3Aevil','%6a%61vascript%3Aevil','javascript%253Aevil','jav&#x61;script:evil','//evil.test','\\\\evil.test','ftp://evil.test']) {
   if(!url.includes('&#')) assert.equal(assistantUrlTransform(url),'',url);
   for(const variant of ['assistant','user']) assert.doesNotMatch(render('[unsafe](<'+url+'>)',variant),/<a\b[^>]*href=/,url);
 }
 for(const url of ['https://example.com','http://example.com','mailto:hello@example.com','/help','./help','../help','#section','?page=2']) assert.equal(assistantUrlTransform(url),url);
});
const noop=()=>{};
function props(content,status='completed',live=true) {
 return {account:{displayName:'Tester',initials:'T',email:'',description:'',timezone:'UTC',spaceDescription:''},live,memoriesCount:0,
 conversation:{id:'c',title:'Chat',group:'Today',updatedAt:'',relatedMemoryIds:[],messages:[{id:'u',sender:'user',content:'**user stays literal**',timestamp:'12:00'},{id:'a',sender:'assistant',content,timestamp:'12:01',status,signInPrompt:true,structuredPoints:[{label:'Detail',value:'Value'}],savedMemoryNotice:{memoryId:'m',summary:'Saved'},citations:[{memoryId:'m',label:'Source'}],actions:[{id:'act',type:'show-memories',label:'Show memories'}]}]},
 onSendMessage:noop,onCitationClick:noop,onActionClick:noop,addedActionIds:[],isSidebarCollapsed:true,onExpandSidebar:noop,onOpenMobileMenu:noop,isContextPanelOpen:false,onToggleContextPanel:noop,plan:'free',onTogglePlan:noop,onOpenPlanModal:noop,theme:'light',onToggleTheme:noop,onNewChat:noop,onSignIn:noop};
}
test('shared live/design chat formats user and assistant and preserves controls/statuses',()=>{
 for(const live of [true,false]) for(const status of ['streaming','completed','failed']) {
  const html=renderToStaticMarkup(React.createElement(ChatWorkspace,props('**assistant**',status,live)));
  assert.match(html,/<strong>user stays literal<\/strong>/);assert.match(html,/<strong>assistant<\/strong>/);
  for(const value of ['Detail','Value','Saved','Source','Show memories','Sign in','12:01','Copy']) assert.ok(html.includes(value),value);
  if(status==='streaming')assert.match(html,/Receiving reply/);
  if(status==='failed')assert.match(html,/Reply failed/);
 }
});
test('user paragraphs, soft breaks and GFM share identical markup in Design and Production',()=>{
 const content='Первая строка\nВторая строка\n\nНовый абзац.\n\n'+sample;
 const outputs=[false,true].map(live=>{
  const input=props('Reply','completed',live);
  input.conversation.messages[0].content=content;
  const html=renderToStaticMarkup(React.createElement(ChatWorkspace,input));
  const user=render(content,'user');
  assert.ok(html.includes(user));
  assert.match(user,/<p>Первая строка<br\/>\nВторая строка<\/p>\n<p>Новый абзац\.<\/p>/);
  for(const tag of ['strong','em','h1','ol','ul','blockquote','code','pre','table']) assert.match(user,new RegExp('<'+tag+'[ >]'));
  assert.doesNotMatch(user,/<img\b/);
  assert.match(user,/target="_blank" rel="noopener noreferrer"/);
  assert.equal(input.conversation.messages[0].content,content);
  return user;
 });
 assert.equal(outputs[0],outputs[1]);
});
test('user long text/code/table keep existing overflow guards and bubble typography',()=>{
 const long='x'.repeat(16000), html=render(long+'\n\n```json\n'+long+'\n```\n\n| Column |\n| --- |\n| '+long+' |','user');
 assert.match(html,/mroya-markdown-user text-\[15px\] leading-\[23px\] text-inherit/);
 assert.match(html,/<pre tabindex="0"><code class="language-json">/);
 assert.match(html,/class="mroya-markdown-scroll"/);
 const css=fs.readFileSync('src/index.css','utf8');
 assert.match(css,/\.mroya-markdown \{[^}]*min-width: 0;[^}]*max-width: 100%;[^}]*overflow-wrap: anywhere/);
 assert.match(css,/\.mroya-markdown pre \{[^}]*max-width: 100%;[^}]*overflow-x: auto/);
 assert.match(css,/\.mroya-markdown-scroll \{[^}]*max-width: 100%;[^}]*overflow-x: auto/);
});
test('history adapter retains raw Markdown across reconstruction',()=>{
 for(const role of ['user','assistant']) {
 const message={id:'a',role,sequence:1,content:sample,status:'completed',created_at:'2026-10-14T12:00:00Z',completed_at:null};
 const original=chatPresentation('c',[message]);
 const restored=chatPresentation('c',JSON.parse(JSON.stringify([message])));
 assert.equal(original.messages[0].content,sample);
 const variant=role==='user'?'user':'assistant';
 assert.equal(render(original.messages[0].content,variant),render(restored.messages[0].content,variant));
 assert.ok(render(restored.messages[0].content,variant).includes('<strong>'));
 }
});
test('Copy handler receives and writes original Markdown rather than rendered HTML',()=>{
 const source=fs.readFileSync('src/components/ChatWorkspace.tsx','utf8');
 assert.match(source,/handleCopyMessage\(msg.id, msg.content\)/);
 const start=source.indexOf('    if (navigator?.clipboard?.writeText)');
 const end=source.indexOf('\n  };',start);
 let written;
 const handler=new Function('navigator','document','copyTimeoutRef','setCopiedMessageId','setTimeout','clearTimeout','id','text',source.slice(start,end));
 handler({clipboard:{writeText:value=>{written=value;return Promise.resolve();}}},{},{current:null},noop,()=>1,noop,'a',sample);
 assert.equal(written,sample);
});

test('live SSE retains partial Markdown and authoritative history after completion/reload',async()=>{
 const {LiveWorkspaceController}=await vite.ssrLoadModule('/src/hooks/LiveWorkspaceController.ts');
 const message={id:'a',role:'assistant',sequence:2,content:'**Streaming reply**',status:'completed',created_at:'2026-10-14T12:00:00Z',completed_at:null};
 let complete=false,release;
 const gate=new Promise(resolve=>{release=resolve;});
 const source={capabilities:async()=>({chat:true,memory_read:false}),history:async()=>({conversation_id:'c',messages:complete?[message]:[],next_before:null}),send:async(_content,_uuid,event)=>{event({event:'delta',data:{text:'**Streaming'}});await gate;event({event:'delta',data:{text:' reply**'}});complete=true;event({event:'done',data:{}});}};
 const controller=new LiveWorkspaceController(source,()=>assert.fail('Session changed'),()=> '00000000-0000-4000-8000-000000000001');
 await controller.load();const sending=controller.send('question');
 assert.equal(controller.snapshot().history.messages.at(-1).content,'**Streaming');
 assert.equal(controller.snapshot().history.messages.at(-1).status,'streaming');
 assert.ok(render(controller.snapshot().history.messages.at(-1).content));
 release();await sending;
 const final=controller.snapshot().history.messages.at(-1);
 assert.equal(final.content,message.content);assert.match(render(final.content),/<strong>Streaming reply<\/strong>/);
 const reloaded=new LiveWorkspaceController(source,()=>{},()=> 'unused');await reloaded.load();
 assert.equal(render(reloaded.snapshot().history.messages.at(-1).content),render(final.content));
 controller.stop();reloaded.stop();
});
