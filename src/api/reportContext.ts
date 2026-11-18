import type {ReportContext} from '../types/api.ts';
export const isTurnUuid=(value:unknown):value is string=>typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
export function readReportContext(value:unknown):ReportContext|undefined {
 if(!value||typeof value!=='object'||Array.isArray(value))return;
 const v=value as Record<string,unknown>;
 const validTrace=typeof v.request_trace_id==='number'&&Number.isSafeInteger(v.request_trace_id)&&v.request_trace_id>0;
 const validToken=typeof v.report_token==='string'&&/^[a-f0-9]{64}$/.test(v.report_token);
 if(!isTurnUuid(v.turn_id)||validTrace===validToken
  ||v.report_url!=='/api/v1/chat/turns/'+v.turn_id+'/report/')return;
 return {turn_id:v.turn_id,...(validTrace?{request_trace_id:v.request_trace_id as number}:{report_token:v.report_token as string}),report_url:v.report_url};
}
export const reportAttemptKey=(context:ReportContext)=>context.turn_id+':'+(context.report_token??context.request_trace_id);
