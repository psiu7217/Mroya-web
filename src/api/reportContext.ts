import type {ReportContext} from '../types/api.ts';
export const isTurnUuid=(value:unknown):value is string=>typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
export function readReportContext(value:unknown):ReportContext|undefined {
 if(!value||typeof value!=='object'||Array.isArray(value))return;
 const v=value as Record<string,unknown>;
 if(!isTurnUuid(v.turn_id)||typeof v.request_trace_id!=='number'||!Number.isSafeInteger(v.request_trace_id)||v.request_trace_id<=0
  ||v.report_url!=='/api/v1/chat/turns/'+v.turn_id+'/report/')return;
 return {turn_id:v.turn_id,request_trace_id:v.request_trace_id,report_url:v.report_url};
}
export const reportAttemptKey=(context:ReportContext)=>context.turn_id+':'+context.request_trace_id;
