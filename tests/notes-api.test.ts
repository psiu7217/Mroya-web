import test from 'node:test';
import assert from 'node:assert/strict';
import {MroyaApi} from '../src/api/client.ts';
import {createLiveSource} from '../src/providers/liveSource.ts';
import {ApiError} from '../src/api/errors.ts';
import {appI18n} from '../src/i18n/index.ts';
import {LiveNotesController,notePresentation,notesSourceAvailable} from '../src/hooks/LiveNotesController.ts';
import type {WorkspaceSource} from '../src/types/source.ts';
import type {NoteSummaryDto,NoteDetailDto} from '../src/types/notesApi.ts';
const id=(n:number)=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
const brief=(n=1):NoteSummaryDto=>({id:id(n),space_uuid:id(100),title:'Synthetic note '+n,summary:'A synthetic note summary',keywords:['Synthetic'],search_phrases:['synthetic phrase'],version:1,sync_status:'pending',created_at:'2026-10-22T12:00:00Z',updated_at:'2026-10-22T12:00:00Z'});
const full=(n=1):NoteDetailDto=>({...brief(n),content:'  # Exact body\r\n\r\n- [ ] Task\n',memory_links:[{space_uuid:id(100),object_uuid:id(101)}]});
const json=(v:unknown,status=200)=>new Response(JSON.stringify(v),{status,headers:{'Content-Type':'application/json'}});
const page=(rows:NoteSummaryDto[]=[],offset=0,has_more=false)=>({notes:rows,offset,limit:20,has_more});
const source=(v:Partial<WorkspaceSource>)=>({kind:'live',...v}) as WorkspaceSource;
const tick=async()=>{for(let i=0;i<12;i++)await Promise.resolve();};
function gate<T>(){let resolve!:(v:T)=>void;const promise=new Promise<T>(r=>resolve=r);return {promise,resolve};}
function store(s:WorkspaceSource,expired=()=>{}){const c=new LiveNotesController(s,expired);c.start();c.setVisible(true);return c;}

test('existing client/source fetch only brief pages and selected detail using same-origin session, preserving exact Markdown',async()=>{
 const calls:{url:string;init:RequestInit|undefined}[]=[];
 const api=new MroyaApi(async(input,init)=>{const url=String(input);calls.push({url,init});return json(url.includes('?')?page([brief()]):{note:full()});});
 const s=createLiveSource(api),p=await s.notes!(0),d=await s.note!(id(1));
 assert.equal(p.notes[0].id,id(1));assert.equal('content' in p.notes[0],false);assert.equal(d.content,full().content);assert.deepEqual(d.memory_links,full().memory_links);
 assert.deepEqual(calls.map(c=>c.url),['/api/v1/notes/?limit=20&offset=0','/api/v1/notes/'+id(1)+'/']);
 for(const c of calls){assert.equal(c.init?.method,'GET');assert.equal(c.init?.credentials,'same-origin');assert.equal(c.init?.cache,'no-store');assert.equal(c.init?.body,undefined);assert.equal(new Headers(c.init?.headers).has('X-CSRFToken'),false);}
 const mapped=notePresentation(p.notes[0]);assert.deepEqual(mapped.tags,['Synthetic']);assert.equal(mapped.category,undefined);assert.equal(mapped.noteType,undefined);assert.equal(mapped.source,undefined);
});

test('reject malformed pages/details and mismatched IDs; propagate HTTP, invalid JSON and aborted transport without pretending empty success',async()=>{
 for(const bad of [{...page(),offset:20},{...page(),has_more:true},page([{...brief(),version:0}]),page([brief(),brief()]),page([{...brief(),keywords:['x'.repeat(81)]}])]){
  await assert.rejects(new MroyaApi(async()=>json(bad)).notes(),(e:any)=>e.code==='invalid_response');
 }
 for(const note of [{...full(),id:id(2)},{...full(),content:42},{...full(),memory_links:[{space_uuid:id(99),object_uuid:id(101)}]}])await assert.rejects(new MroyaApi(async()=>json({note})).note(id(1)),(e:any)=>e.code==='invalid_response');
 for(const status of [401,403,404,503])await assert.rejects(new MroyaApi(async()=>json({error:{code:'note_unavailable',message:'Unavailable'}},status)).notes(),(e:any)=>e.status===status);
 await assert.rejects(new MroyaApi(async()=>new Response('bad',{headers:{'Content-Type':'application/json'}})).notes(),(e:any)=>e.code==='invalid_response');
 let requests=0;const api=new MroyaApi(async()=>{requests++;return json(page());});await assert.rejects(api.note('../me'));await assert.rejects(api.notes(10001));assert.equal(requests,0);
 const abort=new AbortController();abort.abort();await assert.rejects(new MroyaApi(async(_input,init)=>{init?.signal?.throwIfAborted();return json(page());}).notes(0,abort.signal),{name:'AbortError'});
});

test('capability and real source gate old servers/Design; successful empty response differs from pending or failed load and Retry recovers',async()=>{
 const s=source({notes:async()=>page(),note:async()=>full()});assert.equal(notesSourceAvailable(s,true),true);assert.equal(notesSourceAvailable(s,false),false);assert.equal(notesSourceAvailable(source({}),true),false);assert.equal(notesSourceAvailable({...s,kind:'design'},true),false);
 let calls=0;const pending=gate<ReturnType<typeof page>>();const c=store(source({notes:async()=>{calls++;return calls===1?pending.promise:page();},note:async()=>full()}));
 assert.equal(c.snapshot().loaded,false);assert.equal(c.snapshot().loading,true);pending.resolve(page());await tick();assert.equal(c.snapshot().loaded,true);assert.equal(c.snapshot().error,null);assert.deepEqual(c.snapshot().rows,[]);
 c.stop();
 let fail=true;const failed=store(source({notes:async()=>{if(fail)throw Error('offline');return page();},note:async()=>full()}));await tick();assert.equal(failed.snapshot().loaded,false);assert.ok(failed.snapshot().error);fail=false;await failed.refresh();assert.equal(failed.snapshot().loaded,true);assert.equal(failed.snapshot().error,null);failed.stop();
});

test('pagination loads metadata only, deduplicates UUID, keeps server sort, prevents duplicate clicks and refreshes on re-entry after Chat created a note',async()=>{
 let calls:number[]=[],details=0,created=false;const later=gate<ReturnType<typeof page>>();
 const c=store(source({notes:async(offset=0)=>{calls.push(offset);if(offset)return later.promise;return page(created?[brief(99),...Array.from({length:19},(_,i)=>brief(i+1))]:Array.from({length:20},(_,i)=>brief(i+1)),0,!created);},note:async()=>{details++;return full();}}));await tick();
 const one=c.more(),two=c.more();assert.deepEqual(calls,[0,20]);later.resolve(page([brief(20),brief(21)],20));await Promise.all([one,two]);assert.equal(c.snapshot().rows.length,21);assert.equal(c.snapshot().rows[0].id,id(21));assert.equal(c.snapshot().next,null);assert.equal(details,0);
 c.setVisible(false);created=true;const original=c.snapshot().rows.length;assert.equal(original,21);c.setVisible(true);await tick();assert.deepEqual(calls,[0,20,0]);assert.equal(c.snapshot().rows.length,20);assert.equal(c.snapshot().rows[0].id,id(99));assert.equal(c.snapshot().next,null);c.stop();
});

test('opening/closing uses selected-only detail; 404/403 remain retryable errors, not fake content; selected detail refreshes stale metadata',async()=>{
 let reads=0,fail=true;const c=store(source({notes:async()=>page([brief()]),note:async()=>{reads++;if(fail)throw new ApiError(404,'note_not_found','Unavailable');return {...full(),title:'Updated by Chat',version:2};}}));await tick();assert.equal(reads,0);
 c.select(id(1));assert.equal(c.snapshot().detailLoading,true);assert.equal(c.snapshot().detail,null);await tick();assert.ok(c.snapshot().detailError);assert.equal(c.snapshot().detail,null);
 fail=false;c.retryDetail();await tick();assert.equal(c.snapshot().detail?.content,full().content);assert.equal(c.snapshot().rows[0].title,'Updated by Chat');c.select(null);assert.equal(c.snapshot().selectedId,null);assert.equal(c.snapshot().detail,null);c.stop();
});

test('stale list/detail cannot survive section switch, new selection, logout or different account',async()=>{
 const oldPage=gate<ReturnType<typeof page>>(),oldDetail=gate<NoteDetailDto>();let reads=0;
 const c=store(source({notes:async()=>++reads===1?oldPage.promise:page([brief(2)]),note:async()=>oldDetail.promise}));
 c.setVisible(false);c.setVisible(true);await tick();oldPage.resolve(page([brief(1)]));await tick();assert.equal(c.snapshot().rows[0].id,id(2));
 c.select(id(2));c.select(null);oldDetail.resolve(full(2));await tick();assert.equal(c.snapshot().detail,null);assert.equal(c.snapshot().selectedId,null);
 const pending=gate<ReturnType<typeof page>>();const old=store(source({notes:async()=>pending.promise,note:async()=>full()}));old.stop();const other=store(source({notes:async()=>page([brief(3)]),note:async()=>full(3)}));await tick();pending.resolve(page([brief(1)]));await tick();assert.equal(old.snapshot().rows.length,0);assert.equal(other.snapshot().rows[0].id,id(3));assert.notEqual(old.scopeKey,other.scopeKey);old.stop();other.stop();c.stop();
});

test('401 expires session and clears private state; restored session can load again; 403 never silently authenticates or substitutes data',async()=>{
 let expired=0,status=200;const s=createLiveSource(new MroyaApi(async()=>status===200?json(page([brief()])):json({error:{code:'denied',message:'Denied'}},status)));
 const c=store(s,()=>expired++);await tick();await tick();status=401;await c.refresh();assert.equal(expired,1);assert.deepEqual(c.snapshot().rows,[]);assert.equal(c.snapshot().loaded,false);
 status=200;c.start();c.setVisible(true);await tick();await tick();assert.equal(c.snapshot().rows.length,1);status=403;await c.refresh();assert.equal(expired,1);assert.ok(c.snapshot().error);assert.equal(c.snapshot().loading,false);c.stop();
});


test('selected detail remains retryable if a concurrent first-page refresh no longer contains its metadata',async()=>{
 const detail=gate<NoteDetailDto>();let reads=0;
 const c=store(source({notes:async()=>page(++reads===1?[brief()]:[]),note:async()=>detail.promise}));await tick();
 c.select(id(1));await c.refresh();assert.equal(c.snapshot().rows.length,0);assert.equal(c.snapshot().selectedSummary?.id,id(1));
 detail.resolve(full());await tick();assert.equal(c.snapshot().detail?.id,id(1));c.select(null);assert.equal(c.snapshot().selectedSummary,null);c.stop();
});
test('Notes controller translates access, unavailable-note and network errors in the active locale',async()=>{
 await appI18n.changeLanguage('en');
 const denied=store(source({notes:async()=>{throw new ApiError(403,'denied','Backend text');},note:async()=>full()}));await tick();
 assert.equal(denied.snapshot().error,'Notes access was denied. Check your session and retry.');
 await appI18n.changeLanguage('ru');await denied.refresh();
 assert.equal(denied.snapshot().error,'Нет доступа к заметкам. Проверьте авторизацию и повторите попытку.');denied.stop();
 const unavailable=store(source({notes:async()=>page([brief()]),note:async()=>{throw new ApiError(404,'note_not_found','Backend text');}}));await tick();
 unavailable.select(id(1));await tick();assert.equal(unavailable.snapshot().detailError,'Заметка больше недоступна.');unavailable.stop();
 const network=store(source({notes:async()=>{throw new TypeError('network details');},note:async()=>full()}));await tick();
 assert.equal(network.snapshot().error,'Не удалось загрузить заметки. Проверьте подключение и повторите попытку.');network.stop();
 await appI18n.changeLanguage('en');
});


test('list retains precise server updated_at ordering and an invalid selection cannot strand a pending read',async()=>{
 const first={...brief(1),updated_at:'2026-10-22T12:00:00.000002+00:00'},second={...brief(9),updated_at:'2026-10-22T12:00:00.000001+00:00'};
 const read=gate<NoteDetailDto>(),c=store(source({notes:async()=>page([first,second]),note:async()=>read.promise}));await tick();assert.equal(c.snapshot().rows[0].id,id(1));
 c.select(id(1));c.select(id(999));read.resolve({...full(),updated_at:first.updated_at});await tick();assert.equal(c.snapshot().detail?.id,id(1));assert.equal(c.snapshot().detailLoading,false);c.stop();
});
