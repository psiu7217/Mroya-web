import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {createServer} from 'vite';
const vite=await createServer({mode:'production',server:{middlewareMode:true,hmr:false},appType:'custom'});
after(()=>vite.close());
const {MemoryReviewPanel}=await vite.ssrLoadModule('/src/components/MemoryReviewPanel.tsx');
const {appI18n}=await vite.ssrLoadModule('/src/i18n/index.ts');
const noop=()=>{};
const props={data:{eligible_count:2,summary:{total:1,pending:0,processing:0,completed:1,error:0,stale:0},processing_enabled:true,worker_available:true,is_complete:true,next_offset:null,
 results:[{id:'synthetic-job',source_preview:{title:'Synthetic <script>event</script>',calendar_name:'Personal',date:'2026-04-18'},status:'completed',error_code:null,result:{decision:'KEEP',explanation:'Evidence-based draft',model:'synthetic/model',processed_at:'2026-10-25T10:00:00Z',proposals:[{formulation:'Synthetic draft',information_type:'birthday',memory_placement:'Object → Statement',usefulness:'Annual date',entities:[],relations:[],evidence:[{field:'title',quote:'birthday'}],uncertainties:['Unknown year']}]}}]},loading:false,busy:false,error:null,offset:0,receipt:null,onEnqueue:noop,onRefresh:noop,onRetry:noop,onNext:noop,onPrevious:noop};
test('Production review shows drafts and retry without diagnostic metadata in RU and EN',async()=>{
 const completed=structuredClone(props.data.results[0]);
 Object.assign(completed.result.proposals[0],{entities:[{local_id:'local_1',description:'Known person'}],evidence:[{field:'internal_field',quote:'Quoted event text'}]});
 const failed={id:'failed',source_preview:{...completed.source_preview,title:'Event to retry'},status:'error',error_code:'internal_failure'};
 const review={...props,data:{...props.data,results:[completed,failed]}};
 for(const language of ['en','ru']){await appI18n.changeLanguage(language);const html=renderToStaticMarkup(React.createElement(MemoryReviewPanel,{review}));
  assert.match(html,/Synthetic draft/);assert.match(html,/Unknown year/);assert.match(html,/&lt;script&gt;/);assert.doesNotMatch(html,/<script>|Save to memory|Сохранить в память|Да, запомнить/);
  assert.match(html,/Known person/);assert.match(html,/Quoted event text/);assert.match(html,/Event to retry/);
  assert.doesNotMatch(html,/internal_failure|internal_field|local_1|synthetic\/model|Object → Statement|2026-10-25T/);
  assert.match(html,language==='ru'?/Углублённый AI-анализ/:/Deep AI review/);
 }
 const empty=renderToStaticMarkup(React.createElement(MemoryReviewPanel,{review:{...props,data:{...props.data,results:[]}}}));assert.doesNotMatch(empty,/Synthetic draft/);
});
test('The explicit action uses the server count and is hidden when processing is disabled',async()=>{
 await appI18n.changeLanguage('en');
 const render=(review)=>renderToStaticMarkup(React.createElement(MemoryReviewPanel,{review}));
 assert.match(render(props),/Send 2 events for deep AI review/);
 assert.doesNotMatch(render({...props,data:{...props.data,processing_enabled:false}}),/Send 2 events/);
 assert.match(render({...props,busy:true}),/disabled=""[^>]*>Send 2 events/);
});
