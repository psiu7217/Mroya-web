import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {createServer} from 'vite';
const vite=await createServer({server:{middlewareMode:true},appType:'custom'});after(()=>vite.close());
const {AiTasksDrawer,ReviewActions}=await vite.ssrLoadModule('/src/components/AiTasksDrawer.tsx');
const {readAiTask}=await vite.ssrLoadModule('/src/api/aiTasks.ts');
const {setAppLanguage}=await vite.ssrLoadModule('/src/i18n/index.ts');
const id='00000000-0000-4000-8000-000000000001';
const dto={id,type:'memory',task_kind:'memory_proposal',description:'Memory searches returned no matching entity. '.repeat(30),
 status:'awaiting_review',created_at:'2026-10-28T12:00:00Z',updated_at:'2026-10-28T12:00:00Z',result:null,error_code:null,
 event_title:'День рождения Володи',event_date:'2026-05-08',version:2,actions:['reject','comment'],facts:[],
 questions:['Who is Volodya and does he correspond to an existing memory entity?'],needs_clarification:true,review_phase:null,result_code:null};
const markup=tasks=>renderToStaticMarkup(React.createElement(AiTasksDrawer,{isOpen:true,onClose(){},tasks,onDecision:async()=>true,onCancel(){}}));

test('Backend questions are displayed unchanged in either UI language; active groups preserve statuses and actions',()=>{
 setAppLanguage('ru');const question=readAiTask(dto);
 const fact=readAiTask({...dto,id:'00000000-0000-4000-8000-000000000002',needs_clarification:false,questions:[],actions:['accept','reject','comment'],
   facts:['Вы: любит мороженое']});
 const running={...question,id:'run',status:'running',reviewActions:[],reviewPhase:'answer_processing'};
 const cancelled={...question,id:'chat',taskKind:'chat',status:'queued',canCancel:true,title:'Обычная задача'};
 const rows=[running,fact,cancelled,question],before=JSON.stringify(rows),html=markup(rows);
 assert.equal(JSON.stringify(rows),before);assert.doesNotMatch(html,/Memory searches|__self__|rationale|00000000/);
 assert.match(html,/Who is Volodya and does he correspond to an existing memory entity\?/);
 assert.match(html,/>Ответить<\/button>/);assert.match(html,/>Пропустить<\/button>/);
 assert.match(html,/Вы: любит мороженое/);assert.match(html,/>Сохранить<\/button>/);assert.match(html,/>Исправить<\/button>/);
 assert.match(html,/Mroya изучает ваш ответ/);assert.match(html,/>Отмена<\/button>/);assert.doesNotMatch(html,/<textarea/);
 assert.ok(html.indexOf('Нужен ваш ответ (1)')<html.indexOf('Предложения (1)'));
 assert.ok(html.indexOf('Предложения (1)')<html.indexOf('Mroya работает (2)'));
 const short=markup([{...question,questions:['Кто такой Володя?']}]);assert.match(short,/Кто такой Володя\?/);
 setAppLanguage('en');assert.match(markup([{...question,questions:['Кто такой Володя?']}]),/Кто такой Володя\?/);
 const long='Who is Volodya? '.repeat(25);
 assert.ok(markup([{...question,questions:[long]}]).includes(long));
});

function all(node){return !node||typeof node!=='object'?[]:[node,...[node.props?.children].flat(Infinity).flatMap(all)];}
test('inline answer retains draft on failure and clears only after confirmed comment',async()=>{
 const task=readAiTask(dto);let comment='Володя — мой друг',editing=true,accepted=false;const calls=[];
 const render=()=>ReviewActions({task,busy:false,editing,comment,onEdit:v=>editing=v,onComment:v=>comment=v,
   onDecision:async(...args)=>{calls.push(args);return accepted;}});
 const submit=async()=>{all(render()).find(n=>n.type==='form').props.onSubmit({preventDefault(){}});await new Promise(r=>setTimeout(r,0));};
 assert.match(renderToStaticMarkup(render()),/Володя — мой друг/);await submit();
 assert.equal(comment,'Володя — мой друг');assert.equal(editing,true);
 assert.deepEqual(calls[0],[task.id,'comment','Володя — мой друг']);
 accepted=true;await submit();assert.equal(comment,'');assert.equal(editing,false);assert.equal(calls.length,2);
});
