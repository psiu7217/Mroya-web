import test from 'node:test';
import assert from 'node:assert/strict';
import {MroyaApi} from '../src/api/client.ts';
import {createLiveSource} from '../src/providers/liveSource.ts';
import {ApiError} from '../src/api/errors.ts';
import {IntelligenceController} from '../src/hooks/useIntelligence.ts';
import {readEventAnalysis} from '../src/api/intelligence.ts';
import {eventAnalysisMessages,canonicalEventId} from '../src/utils/eventAnalysis.ts';
import {memoryLinkTargets} from '../src/hooks/memoryLinkTargets.ts';
import {calendarPresentation} from '../src/hooks/calendarAdapters.ts';
import {notePresentation} from '../src/hooks/LiveNotesController.ts';
import {INBOX_STATUSES,JOB_STATUSES} from '../src/types/intelligenceApi.ts';
import {capabilities,runtime,proposal,proposalId} from './intelligence-fixture.ts';
import {LiveMemoryInboxController} from '../src/hooks/useLiveMemoryInbox.ts';
import {setAppLanguage} from '../src/i18n/index.ts';
import type {WorkspaceSource} from '../src/types/source.ts';
const id='00000000-0000-4000-8000-000000000001',other='00000000-0000-4000-8000-000000000002';
const source=(patch:Partial<WorkspaceSource>)=>({kind:'live',...patch}) as WorkspaceSource;
const json=(v:unknown,status=200)=>new Response(JSON.stringify(v),{status,headers:{'Content-Type':'application/json'}});
const settings={autonomy:'review_all' as const,capabilities};
const status=(patch:Record<string,unknown>={})=>({event_id:id,source:{kind:'calendar',id:other,enabled:true},runtime,job:null,proposal:null,...patch});
const gate=()=>{let resolve!:(v:any)=>void;const promise=new Promise<any>(r=>resolve=r);return {resolve,promise};};
const tick=async()=>{for(let i=0;i<40;i++)await Promise.resolve();};
const base=()=>source({intelligencePreferences:async()=>settings,intelligenceSources:async()=>({sources:[{id,kind:'calendar',name:'Owned calendar',enabled:false}],next_offset:null}),intelligenceStatus:async()=>runtime});

test('settings and source PATCH reuse same-origin session/CSRF, never write Google Sync/privacy; auto_write is rejected before transport',async()=>{
 const calls:{path:string;init:RequestInit|undefined}[]=[];
 const api=new MroyaApi(async(input,init)=>{const path=String(input);calls.push({path,init});
  if(path.endsWith('csrf/'))return json({csrf_token:'synthetic'});
  if(path.includes('sources/calendar/'))return json({source:{kind:'calendar',id,enabled:true}});
  if(path.includes('sources/?'))return json({sources:[{kind:'calendar',id,name:'Owned calendar',enabled:false}],next_offset:null});
  return json({settings:{autonomy:'review_all'},capabilities});});
 const s=createLiveSource(api);await s.intelligencePreferences!();await s.intelligenceSources!();await s.saveIntelligenceSource!(id,true);await s.saveIntelligencePreferences!('review_all');
 const mutations=calls.filter(c=>c.init?.method==='PATCH');assert.equal(mutations.length,2);for(const c of mutations){assert.equal(c.init?.credentials,'same-origin');assert.equal(new Headers(c.init?.headers).get('X-CSRFToken'),'synthetic');}
 assert.deepEqual(JSON.parse(String(mutations[0].init?.body)),{enabled:true});assert.deepEqual(JSON.parse(String(mutations[1].init?.body)),{autonomy:'review_all'});
 assert.ok(calls.every(c=>!c.path.includes('calendar/google')&&!c.path.includes('privacy')));const count=calls.length;await assert.rejects(api.saveIntelligencePreferences('auto_write' as any));assert.equal(calls.length,count);
});

test('confirmed source/autonomy only; PATCH rejection/lost response require read-only Refresh, no optimistic Saved or automatic repeat',async()=>{
 const pending=gate();let writes=0,confirmed=false;
 const c=new IntelligenceController({...base(),saveIntelligenceSource:async()=>{writes++;return pending.promise;},saveIntelligencePreferences:async()=>{throw new ApiError(403,'consent_required','Denied');},intelligenceSources:async()=>({sources:[{kind:'calendar',id,name:'Owned calendar',enabled:confirmed}],next_offset:null})},()=>{});c.start();await c.refresh();
 const write=c.save({id,enabled:true});void c.save({id,enabled:true});assert.equal(writes,1);assert.equal(c.snapshot().sources[0].enabled,false);assert.equal(c.snapshot().busy,true);
 confirmed=true;pending.resolve({kind:'calendar',id,enabled:true});await write;assert.equal(c.snapshot().sources[0].enabled,true);
 await c.save({autonomy:'auto_link'});assert.equal(c.snapshot().preferences?.autonomy,'review_all');assert.ok(c.snapshot().error);await c.save({id,enabled:false});assert.equal(writes,1);await c.refresh();assert.equal(c.snapshot().error,null);c.stop();
 const failed=new IntelligenceController({...base(),saveIntelligenceSource:async()=>{throw Error('lost response');}},()=>{});failed.start();await failed.refresh();await failed.save({id,enabled:true});assert.equal(failed.snapshot().sources[0].enabled,false);assert.ok(failed.snapshot().error);failed.stop();
});

test('source pagination and operator config are independent; stale responses and logout/account switch cannot grant consent',async()=>{
 const pending=gate();const c=new IntelligenceController({...base(),intelligenceSources:async(offset=0)=>offset?{sources:[{kind:'calendar',id:other,name:'Second',enabled:true}],next_offset:null}:{sources:[{kind:'calendar',id,name:'Owned',enabled:false}],next_offset:50}},()=>{});c.start();await c.refresh();await c.refresh(true);assert.equal(c.snapshot().sources.length,2);assert.deepEqual(c.snapshot().runtime,runtime);c.stop();
 const old=new IntelligenceController({...base(),saveIntelligenceSource:async()=>pending.promise},()=>{});old.start();await old.refresh();const write=old.save({id,enabled:true});old.stop();const next=new IntelligenceController(base(),()=>{});next.start();await next.refresh();pending.resolve({kind:'calendar',id,enabled:true});await write;assert.equal(old.snapshot().sources.length,0);assert.equal(next.snapshot().sources[0].enabled,false);next.stop();
});

test('all event job/proposal enums, separate receipts, search_pending and no-job state use only confirmed data',()=>{
 setAppLanguage('ru');
 assert.match(eventAnalysisMessages(readEventAnalysis(status(),id)).join(' '),/Нет данных/);assert.doesNotMatch(eventAnalysisMessages(readEventAnalysis(status(),id)).join(' '),/Проанализировано|сохранён/);
 for(const jobStatus of JOB_STATUSES)assert.ok(eventAnalysisMessages(readEventAnalysis(status({job:{status:jobStatus,decision:'candidate'}}),id)).length);
 for(const proposalStatus of INBOX_STATUSES){const value=readEventAnalysis(status({proposal:{id:other,status:proposalStatus,version:1,canonical_saved:false,links_saved:false,search_ready:false}}),id);assert.ok(eventAnalysisMessages(value).length);}
 const p={id:other,status:'applied',version:1,canonical_saved:false,links_saved:true,search_ready:false};let lines=eventAnalysisMessages(readEventAnalysis(status({proposal:p}),id)).join(' ');assert.match(lines,/Связь с памятью сохранена/);assert.match(lines,/Обновляется поисковый индекс/i);assert.doesNotMatch(lines,/Новый факт сохранён/);
 lines=eventAnalysisMessages(readEventAnalysis(status({proposal:{...p,links_saved:false,canonical_saved:true,search_ready:true}}),id)).join(' ');assert.match(lines,/Новый факт сохранён/);assert.doesNotMatch(lines,/Связь с памятью сохранена/);
 lines=eventAnalysisMessages(readEventAnalysis(status({proposal:{...p,status:'pending_apply',canonical_saved:true}}),id)).join(' ');assert.doesNotMatch(lines,/сохранена|сохранён/);assert.match(lines,/ещё не сохранено/);
 assert.throws(()=>readEventAnalysis(status({job:{status:'invented',decision:null}}),id));assert.throws(()=>readEventAnalysis(status({event_id:other}),id));
});

test('event status only loads selected canonical event/series and explicit Refresh; old backend errors never break Calendar',async()=>{
 let calls=0,expired=0;const pending=gate();const c=new IntelligenceController({...base(),eventAnalysis:async(eventId)=>{calls++;return calls===1?pending.promise:readEventAnalysis(status({event_id:eventId}),eventId);}},()=>expired++);c.start();assert.equal(calls,0);
 c.selectEvent(id);c.selectEvent(other);await tick();pending.resolve(readEventAnalysis(status(),id));await tick();assert.equal(c.snapshot().event?.event_id,other);await c.refreshEvent();assert.equal(calls,3);c.selectEvent(null);assert.equal(c.snapshot().event,null);c.stop();
 for(const code of [404,405,501,403,401]){const x=new IntelligenceController({...base(),eventAnalysis:async()=>{throw new ApiError(code,'unavailable','Unavailable');}},()=>expired++);x.start();x.selectEvent(id);await tick();if(code===401)assert.equal(x.snapshot().eventId,null);else {assert.ok(x.snapshot().eventError);assert.equal(x.snapshot().event,null);}x.stop();}
 assert.equal(expired,1);assert.equal(canonicalEventId({api:{id,series_id:other},id:'occurrence:any'} as any),other);assert.equal(canonicalEventId({api:{id},id:'occurrence:any'} as any),id);
});

test('calendar/notes links preserve confirmed IDs; resolve only already loaded owner-scoped entities, never UUID-based network lookup',()=>{
 const targets=memoryLinkTargets({nodes:[{id:'entity:'+id,type:'entity',label:'Owned person'},{id:'memory:'+other,type:'memory',label:'Statement'}],edges:[]});assert.deepEqual(targets[id],{nodeId:'entity:'+id,label:'Owned person'});assert.equal(targets[other],undefined);
 const links=[{space_uuid:other,object_uuid:id}],dto:any={id,title:'Synthetic',date:'2026-10-24',time_kind:'all_day',source:{kind:'local'},description:'',memory_links:links};assert.deepEqual(calendarPresentation(dto).memoryLinks,links);
 const note:any={id,title:'Synthetic',summary:'A note',keywords:[],search_phrases:[],content:'# Raw',updated_at:'2026-10-24T00:00:00Z',created_at:'2026-10-24T00:00:00Z',memory_links:links};assert.deepEqual(notePresentation(note).memoryLinks,links);assert.equal(notePresentation({...note,memory_links:[]}).content,'# Raw');
});

test('Calendar proposal navigation uses existing Inbox detail/history controller, including unloaded cards; never accepts automatically',async()=>{
 let decisions=0;
 const s=source({intelligenceSettings:async()=>capabilities,intelligenceStatus:async()=>runtime,inboxProposals:async()=>({proposals:[],next_offset:null}),inboxProposal:async()=>proposal(),inboxHistory:async()=>({history:[],next_offset:null}),inboxDecision:async()=>{decisions++;throw Error('must not accept');}});
 const inbox=new LiveMemoryInboxController(s,1,()=>{});inbox.start();inbox.setVisible(true);await tick();await inbox.focus(proposalId);assert.equal(inbox.presentation().focusedId,proposalId);assert.equal(inbox.presentation().proposals[0].id,proposalId);assert.equal(decisions,0);inbox.stop();
});
