import type {IntelligenceProposal,IntelligenceCapabilities,IntelligenceRuntime,IntelligenceAction,IntelligenceStatus,JsonValue} from '../types/intelligenceApi.ts';
import type {InboxProposal} from '../types/memoryInbox.ts';
export const inboxStatusLabels:Record<IntelligenceStatus,string>={pending:'Ожидает решения',reanalyzing:'Повторный анализ',rejected:'Отклонено',pending_apply:'Подтверждено, ожидает применения',applying:'Выполняется сохранение',applied:'Операция завершена',search_pending:'Память сохранена, поиск обновляется',apply_conflict:'Конфликт применения',apply_retry:'Временная ошибка применения',apply_error:'Ошибка применения',stale:'Предложение устарело',error:'Ошибка анализа',no_proposal:'Полезных изменений нет'};
export function inboxActions(p:IntelligenceProposal,c:IntelligenceCapabilities,r:IntelligenceRuntime|null){
 const frozen=['pending_apply','applying','apply_retry','search_pending','applied','apply_error'].includes(p.status)||p.canonical_saved;
 const source=p.source_preview.available,deep=!!r?.worker_enabled&&r.deep_enabled&&c.deep_analysis,apply=!!r?.worker_enabled&&r.apply_enabled&&c.memory_apply;
 return {accept:!frozen&&p.status==='pending'&&source&&apply&&!p.plan.actions.some(a=>a.type==='clarify'||a.type==='skip'),
  reject:!frozen,comment:!frozen&&p.status!=='rejected'&&source&&deep,
  reconsider:!frozen&&p.status==='rejected'&&source&&deep,
  retry:['apply_retry','apply_error','search_pending'].includes(p.status)&&apply};
}
export function runtimeNotice(c:IntelligenceCapabilities,r:IntelligenceRuntime|null){
 if(!r)return 'Состояние фоновой обработки не подтверждено. Обновите Inbox перед новым действием.';
 const messages=[];
 if(!r.worker_enabled)messages.push('Фоновая обработка выключена.');
 else {if(!r.deep_enabled||!c.deep_analysis)messages.push('Глубокий анализ выключен.');if(!r.apply_enabled||!c.memory_apply)messages.push('Применение предложений выключено.');}
 if(!c.auto_link)messages.push('Автоматическое связывание недоступно.');
 if(!c.auto_write)messages.push('Автоматическая запись новых знаний недоступна.');
 return messages.join(' ');
}
function show(value:JsonValue|undefined):string{
 if(value===undefined)return '';
 if(value&&typeof value==='object'&&!Array.isArray(value)){
  if(value.reference==='self')return 'Ваш профиль';
  if(value.reference==='existing')return String(value.object_uuid);
  if(value.reference==='new')return String(value.ref);
  if(value.type==='literal')return typeof value.literal_value==='string'?value.literal_value:JSON.stringify(value.literal_value);
 }
 return typeof value==='string'?value:JSON.stringify(value);
}
function actionText(a:IntelligenceAction,p:IntelligenceProposal):string{
 const name=(id:string)=>p.plan.matches.flatMap(m=>m.objects).find(o=>o.object_uuid===id)?.label??id;
 if(a.type==='link')return 'Связать событие с памятью: '+name(a.target!.object_uuid)+(a.reason?' — '+a.reason:'');
 if(a.type==='create_object')return 'Создать объект: '+a.entity!.label+' ('+a.entity!.kind+') — '+a.reason;
 if(a.type==='clarify')return 'Уточнить: '+a.question;
 if(a.type==='skip')return 'Без изменений: '+a.reason;
 const s=a.statement!,predicate=s.predicate as {[key:string]:JsonValue};
 const endpoint=(value:JsonValue)=>{const obj=value as {[key:string]:JsonValue};return obj?.reference==='existing'?name(String(obj.object_uuid)):show(value);};
 return (a.type==='revise_fact'?'Изменить факт: ':a.type==='add_relation'?'Добавить связь: ':'Добавить факт: ')+endpoint(s.subject)+' — '+show(predicate.label??predicate.key)+' — '+endpoint(s.value)+' — '+a.reason;
}
export function receiptMessage(p:IntelligenceProposal):string|undefined{
 const links=p.apply?.result.links_saved===true;
 if(p.canonical_saved)return p.search_ready?'Изменения сохранены в долговременную память.': 'Память сохранена. Поисковый индекс обновляется.';
 if(links)return 'Событие связано с памятью. Новые знания не добавлялись.';
 if(p.status==='applied')return 'Операция завершена Backend. Запись новых знаний не подтверждена.';
 return undefined;
}
export function proposalPresentation(p:IntelligenceProposal,c:IntelligenceCapabilities,r:IntelligenceRuntime|null):InboxProposal{
 const preview=p.source_preview;
 const recurrence=preview.recurrence?JSON.stringify(preview.recurrence):'';
 return {id:p.id,version:p.version,title:preview.available?preview.title!:'Источник недоступен',source:'Calendar',sourceLabel:'Календарь Mroya',sourceAvailable:preview.available,
  sourceResourceTitle:preview.available?[preview.calendar_name,preview.title].filter(Boolean).join(' · '):'Источник недоступен',
  sourceDate:preview.available?[preview.date,preview.time_kind==='all_day'?'Весь день':preview.time_kind==='exact'?'Точное время':preview.time_kind,recurrence].filter(Boolean).join(' · '):'',
  actionProposed:p.plan.actions.map(a=>actionText(a,p)).join('\n'),explanation:p.plan.rationale,
  memoryMatches:p.plan.matches.flatMap(m=>m.objects.map(o=>({id:o.object_uuid,name:o.label??o.object_uuid,relation:[m.mention,o.kind].filter(Boolean).join(' · ')}))),
  status:p.status,statusLabel:p.status==='search_pending'&&!p.canonical_saved?'Ожидает подтверждения обновления поиска':inboxStatusLabels[p.status],resultMessage:receiptMessage(p),statusMessage:p.apply?.code??undefined,
  actions:inboxActions(p,c,r),isConfirmed:p.canonical_saved||p.apply?.result.links_saved===true,
  processingEnabled:!!r?.worker_enabled&&(p.status==='reanalyzing'?r.deep_enabled:r.apply_enabled),
  errorMessage:p.apply?.code??(p.status==='error'?'Анализ не завершён. Уточните предложение комментарием, если повторный анализ доступен.':undefined)};
}
