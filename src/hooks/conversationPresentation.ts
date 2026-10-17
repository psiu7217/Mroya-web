import type {ConversationSummary} from '../types/api.ts';
import type {ConversationListItem} from '../types/mroya.ts';
// Calendar-day grouping in the profile timezone; retain server order within each group.
export function conversationListPresentation(items:ConversationSummary[],timezone:string,now=new Date()):ConversationListItem[]{
 let day:Intl.DateTimeFormat;
 try{day=new Intl.DateTimeFormat('en-CA',{timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit'});}catch{day=new Intl.DateTimeFormat('en-CA',{timeZone:'UTC',year:'numeric',month:'2-digit',day:'2-digit'});timezone='UTC';}
 const ordinal=(d:Date)=>{const parts=day.formatToParts(d);const get=(type:string)=>Number(parts.find(p=>p.type===type)?.value);return Date.UTC(get('year'),get('month')-1,get('day'))/86400000;};
 const today=ordinal(now),month=new Intl.DateTimeFormat('en-US',{timeZone:timezone,month:'long',year:'numeric'});
 return items.map(item=>{const updated=new Date(item.updated_at),age=today-ordinal(updated);return {
  id:item.id,title:item.title||'New chat',updatedAt:item.updated_at,
  group:age<=0?'Today':age<=7?'Previous 7 Days':month.format(updated),
 };});
}
