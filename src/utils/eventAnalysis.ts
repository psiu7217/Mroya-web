import type {EventAnalysisStatus} from '../types/intelligenceApi.ts';
import type {CalendarEvent} from '../types/mroya.ts';
export function canonicalEventId(event:CalendarEvent|null):string|null{return event?.api?(event.api.series_id??event.api.id):null;}
export function eventAnalysisMessages(data:EventAnalysisStatus):string[]{
 const messages:string[]=[];
 if(!data.source.enabled)messages.push('Анализ для календаря выключен.');
 if(!data.runtime.worker_enabled)messages.push('Обработка выключена на сервере.');
 if(!data.runtime.deep_enabled)messages.push('Deep Analysis выключен на сервере.');
 if(!data.runtime.apply_enabled)messages.push('Apply выключен на сервере.');
 const p=data.proposal;
 if(p){
  const labels={pending:'Создано предложение. Требуется подтверждение.',reanalyzing:'Повторный анализ выполняется.',rejected:'Предложение отклонено.',pending_apply:'Ожидается применение — ещё не сохранено.',applying:'Применение выполняется — результат ещё не подтверждён.',applied:'Применение завершено.',search_pending:'Retrieval обновляется.',apply_conflict:'Конфликт. Требуется проверка в Inbox.',apply_retry:'Ошибка применения. Ожидается повтор.',apply_error:'Ошибка применения.',stale:'Событие изменилось или источник недоступен.',error:'Ошибка анализа.',no_proposal:'Предложение не создано.'};
  messages.push(labels[p.status]);
  const confirmed=!['pending','pending_apply','applying','reanalyzing'].includes(p.status);
  if(confirmed&&p.links_saved)messages.push('Связь с памятью сохранена.');
  if(confirmed&&p.canonical_saved)messages.push('Новый факт сохранён.');
  if(confirmed&&(p.links_saved||p.canonical_saved)&&!p.search_ready&&p.status!=='search_pending')messages.push('Retrieval обновляется.');
 }else if(data.job){
  const labels={queued:'Обработка ожидается.',triaging:'Предварительный анализ выполняется.',awaiting_analysis:'Ожидается Deep Analysis.',analyzing:'Deep Analysis выполняется.',analyzed:'Анализ обработан; предложение отсутствует.',irrelevant:'Долговременных изменений не предложено.',skipped:'Предложение не создано.',suppressed:'Обработка подавлена.',stale:'Источник изменился или недоступен.',error:'Ошибка обработки.',analysis_error:'Ошибка Deep Analysis.'};messages.push(labels[data.job.status]);
 }else messages.push('Нет данных об обработке этого события.');
 return messages;
}
