import type {NotificationPresentation} from '../types/workspace';
import type {NotificationDto,NotificationDeliveryStatus} from '../types/api';

// Design-only scenarios. Studio can seed any scenario without adding visual controls.
export type NotificationDemoScenario='disconnected'|'disabled'|'enabled'|'queued'|'delivered'|'failed'|'unavailable';
export const NOTIFICATION_DEMO_SCENARIOS:NotificationDemoScenario[]=['disconnected','disabled','enabled','queued','delivered','failed','unavailable'];
export function demoNotifications(scenario:NotificationDemoScenario,telegramConnected:boolean,set:(scenario:NotificationDemoScenario)=>void):NotificationPresentation {
 const connected=telegramConnected&&scenario!=='disconnected',configured=scenario!=='unavailable';
 const enabled=['enabled','queued','delivered','failed'].includes(scenario);
 const status:NotificationDeliveryStatus|null=scenario==='queued'?'pending':scenario==='delivered'?'sent':scenario==='failed'?'failed':null;
 const date='2026-10-21T12:00:00Z';
 const lastTest:NotificationDto|null=status?{notification_id:'00000000-0000-4000-8000-000000000035',kind:'system.test',created_at:date,scheduled_at:date,expires_at:null,
  deliveries:[{channel:'telegram',status,attempts:status==='pending'?0:1,next_attempt_at:status==='pending'?date:null,sent_at:status==='sent'?date:null,error_code:status==='failed'?'telegram_unavailable':null,parts_sent:status==='sent'?1:0}]}:null;
 return {available:true,loading:false,saving:false,testing:false,enabled,connected,configured,deliveryReady:connected&&configured&&enabled,
  canEnable:connected&&configured,canSendTest:connected&&configured&&enabled,simulated:true,error:scenario==='unavailable'?'Design simulation: notification service unavailable.':null,lastTest,lastTestStatus:status,
  onToggleTelegram:async value=>{if(!value||connected&&configured)set(value?'enabled':'disabled');},
  onSendTest:async()=>{if(connected&&configured&&enabled)set('queued');},
  onRefresh:async()=>{if(scenario==='queued')set('delivered');},
  onRetry:async()=>{if(scenario==='unavailable')set('disabled');else if(scenario==='failed'&&connected)set('queued');}};
}
