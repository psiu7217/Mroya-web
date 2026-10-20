import {ApiError} from './errors.ts';
import type {NotificationDto,NotificationDeliveryStatus,NotificationSettings} from '../types/api.ts';

export const notificationUuid=(v:unknown):v is string=>typeof v==='string'&&/^[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/i.test(v);
const invalid=():never=>{throw new ApiError(502,'invalid_response','Invalid notification response');};
const object=(v:unknown):Record<string,unknown>=>v&&typeof v==='object'&&!Array.isArray(v)?v as Record<string,unknown>:invalid();
const date=(v:unknown):v is string=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(v)&&Number.isFinite(Date.parse(v));
const count=(v:unknown)=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=0;
export function readNotificationSettings(value:unknown):NotificationSettings {
 const v=object(object(object(value).channels).telegram);
 if(!['enabled','connected','configured','delivery_ready'].every(k=>typeof v[k]==='boolean')
   ||v.delivery_ready&&(!v.enabled||!v.connected||!v.configured))invalid();
 return {channels:{telegram:{enabled:v.enabled as boolean,connected:v.connected as boolean,configured:v.configured as boolean,delivery_ready:v.delivery_ready as boolean}}};
}
export function readNotification(value:unknown,expectedId?:string):NotificationDto {
 const v=object(value);
 if(!notificationUuid(v.notification_id)||expectedId&&v.notification_id!==expectedId||v.kind!=='system.test'
   ||!date(v.created_at)||!date(v.scheduled_at)||v.expires_at!==null&&!date(v.expires_at)
   ||!Array.isArray(v.deliveries)||v.deliveries.length!==1)invalid();
 const deliveries=(v.deliveries as unknown[]).map(raw=>{
  const d=object(raw),status=d.status as NotificationDeliveryStatus;
  if(d.channel!=='telegram'||!['pending','processing','retry','sent','failed','cancelled','expired'].includes(status)
    ||!count(d.attempts)||!count(d.parts_sent)||!(d.error_code===null||typeof d.error_code==='string'&&/^[a-z][a-z0-9_]{0,79}$/.test(d.error_code))
    ||(['pending','retry'].includes(status)?!date(d.next_attempt_at):d.next_attempt_at!==null)
    ||(status==='sent'?!date(d.sent_at):d.sent_at!==null))invalid();
  return {channel:'telegram' as const,status,attempts:d.attempts as number,parts_sent:d.parts_sent as number,
   next_attempt_at:d.next_attempt_at as string|null,sent_at:d.sent_at as string|null,error_code:d.error_code as string|null};
 });
 return {notification_id:v.notification_id as string,kind:'system.test',created_at:v.created_at as string,scheduled_at:v.scheduled_at as string,expires_at:v.expires_at as string|null,deliveries};
}
