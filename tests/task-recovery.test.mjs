import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'vite';
const vite=await createServer({mode:'design',server:{middlewareMode:true,hmr:false},appType:'custom'});
after(()=>vite.close());
const {ReviewActions,taskFailureLabel}=await vite.ssrLoadModule('/src/components/AiTasksDrawer.tsx');
const {setAppLanguage}=await vite.ssrLoadModule('/src/i18n/index.ts');
const base={id:'00000000-0000-4000-8000-000000000001',taskKind:'memory_proposal',reviewVersion:4,reviewActions:['retry'],status:'failed'};
function nodes(node){return !node||typeof node!=='object'?[]:[node,...[node.props?.children].flat(Infinity).flatMap(nodes)];}
function render(task,busy,onDecision){return nodes(ReviewActions({task,busy,onDecision,editing:false,comment:'',onEdit(){},onComment(){}}));}
for(const status of ['failed','cancelled'])test(`${status} exposes an explicit Retry callback only with backend permission`,async()=>{
 setAppLanguage('ru');const calls=[];const callback=async(...args)=>{calls.push(args);return true;};
 const button=render({...base,status},false,callback).find(n=>n.type==='button'&&n.props.children==='Повторить');
 assert.ok(button);assert.equal(button.props.disabled,false);button.props.onClick();
 await Promise.resolve();assert.deepEqual(calls,[[base.id,'retry',undefined]]);
 assert.equal(render({...base,status,reviewActions:[]},false,callback).filter(n=>n.type==='button').length,0);
 assert.equal(render({...base,status},true,callback).find(n=>n.type==='button').props.disabled,true);
});
test('historical guard failures describe an unconfirmed save without asserting a real duplicate or conflict',()=>{
 setAppLanguage('ru');assert.match(taskFailureLabel({...base,errorMessage:'new_entity_candidate_found'}),/предыдущая проверка.*совпадений/);
 assert.match(taskFailureLabel({...base,errorMessage:'confirmed_memory_conflict'}),/возможного противоречия/);
 const internal='sensitive-unexpected-error';assert.doesNotMatch(taskFailureLabel({...base,errorMessage:internal}),new RegExp(internal));
 setAppLanguage('en');assert.match(taskFailureLabel({...base,errorMessage:'new_entity_candidate_found'}),/previous check.*possible matches/);
 assert.match(taskFailureLabel({...base,errorMessage:'source_unavailable'}),/no longer available/);
});
