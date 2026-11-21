import {useEffect,useLayoutEffect,useMemo,useRef,useState} from 'react';
import {CalendarDays,CalendarRange,ChevronLeft,ChevronRight,Plus,X} from 'lucide-react';
import {calendarDate,calendarKey} from '../utils/calendarDates';
import type {CalendarEvent} from '../types/mroya';
import type {CalendarPresentation} from '../types/workspace';
import {tr} from '../i18n';
import {currentLocale,formatDate,monthName,weekdayName} from '../i18n/format';
import {DialogFocus} from './DialogFocus';
import {WorkspaceMenuButton} from './WorkspaceMenuButton';

const copy=(key:string)=>tr(key,{ns:'calendar'});
const action='grid min-h-10 min-w-10 place-items-center rounded-xl hover:bg-[var(--mroya-surface-muted)] disabled:opacity-50';

interface Props {
 today:Date; events:CalendarEvent[]; calendar?:CalendarPresentation;
 active:boolean; readOnly:boolean; showGoogle:boolean; googleStatus:string;
 onYearChange:(year:number)=>void; onNew:(date:Date)=>void;
 onEvent:(event:CalendarEvent)=>void; onGoogle:()=>void;
}
export function MobileCalendar({today,events,calendar,active,readOnly,showGoogle,googleStatus,onYearChange,onNew,onEvent,onGoogle}:Props){
 const [selected,setSelected]=useState(()=>calendarKey(today));
 const [year,setYear]=useState(()=>today.getFullYear());
 const [windowYear,setWindowYear]=useState(year);
 const [yearMode,setYearMode]=useState(false);
 const [panel,setPanel]=useState<'day'|'upcoming'|null>(null);
 const scroll=useRef<HTMLDivElement>(null);
 const target=useRef<string|null>(selected.slice(0,7));
 const observerCallback=useRef(onYearChange);
 observerCallback.current=onYearChange;

 const todayKey=calendarKey(today);
 const locale=currentLocale();
 const months=useMemo(()=>{
  const dayLabel=new Intl.DateTimeFormat(locale,{day:'numeric',month:'long',year:'numeric'});
  return Array.from({length:36},(_,index)=>{
   const date=calendarDate(windowYear-1,index,1);
   const year=date.getFullYear(),month=date.getMonth();
   return {
    key:calendarKey(date).slice(0,7),name:monthName(month,'long',locale),first:(date.getDay()+6)%7,
    days:Array.from({length:new Date(year,month+1,0,12).getDate()},(_,day)=>{
     const date=calendarDate(year,month,day+1);
     return {key:calendarKey(date),number:day+1,label:dayLabel.format(date)};
    }),
   };
  });
 },[windowYear,locale]);
 const days=useMemo(()=>{
  const index=new Map<string,CalendarEvent[]>();
  for(const event of events){
   const [y,m,d]=event.date.split('-').map(Number);
   const end=event.api?.end_date??event.date;
   for(let date=calendarDate(y,m-1,d),i=0;i<=366;i++,date.setDate(date.getDate()+1)){
    const key=calendarKey(date);
    if(key>end||(event.api?.time_kind==='all_day'&&event.api.end_date&&key===end))break;
    const current=index.get(key);
    if(current)current.push(event);
    else index.set(key,[event]);
   }
  }
  return index;
 },[events]);

 useLayoutEffect(()=>{
  const container=scroll.current;
  if(!container||!target.current)return;
  const month=container.querySelector<HTMLElement>(`[data-mobile-month="${target.current}"]`);
  if(month){container.scrollTop+=month.getBoundingClientRect().top-container.getBoundingClientRect().top;target.current=null;}
 },[active,months,yearMode,selected]);
 useEffect(()=>{
  const root=scroll.current;
  if(!active||yearMode||!root)return;
  const observer=new IntersectionObserver(entries=>{
   const latest=entries.find(entry=>entry.isIntersecting);
   if(!latest)return;
   const visible=Number((latest.target as HTMLElement).dataset.mobileMonth?.slice(0,4));
   if(!Number.isFinite(visible))return;
   setYear(visible);
   observerCallback.current(visible);
  },{root,rootMargin:'0px 0px -80% 0px'});
  root.querySelectorAll('[data-mobile-month]').forEach(month=>observer.observe(month));
  return()=>observer.disconnect();
 },[active,months,yearMode]);

 const jump=(date:Date)=>{
  const key=calendarKey(date),nextYear=date.getFullYear();
  target.current=key.slice(0,7);
  if(Math.abs(nextYear-windowYear)>1)setWindowYear(nextYear);
  setYear(nextYear);
  onYearChange(nextYear);
  setYearMode(false);
  setSelected(key);
  const container=scroll.current;
  const month=container?.querySelector<HTMLElement>(`[data-mobile-month="${target.current}"]`);
  if(container&&month){container.scrollTop+=month.getBoundingClientRect().top-container.getBoundingClientRect().top;target.current=null;}
 };
 const changeYear=(value:number)=>{setYear(value);onYearChange(value);};
 const upcoming=calendar?.upcoming?.events??[];
 const rows=panel==='day'?(days.get(selected)??[]):upcoming;
 const oneWeek=useMemo(()=>Array.from({length:7},(_,day)=>weekdayName(day,'short',locale)),[locale]);
 const title=panel==='day'?formatDate(selected+'T12:00:00Z',{weekday:'long',day:'numeric',month:'long'},'UTC'):copy('upcomingCommitments');
 return <div className="flex min-h-0 flex-1 flex-col lg:hidden">
  <header className="flex min-h-14 shrink-0 items-center gap-1 border-b border-[var(--mroya-divider)] px-3">
   <WorkspaceMenuButton/>
   <button type="button" aria-label={copy(yearMode?'backMonth':'showYear')} onClick={()=>yearMode?jump(calendarDate(year,0,1)):setYearMode(true)} className="flex min-h-10 items-center rounded-lg px-1.5 text-base font-semibold text-[var(--mroya-primary)]">
    <ChevronLeft aria-hidden="true" className="size-5"/>{year}
   </button>
   <button type="button" disabled={readOnly} aria-label={copy('newEvent')} onClick={()=>onNew(new Date(selected+'T12:00:00'))} className={action+' ml-auto'}><Plus aria-hidden="true" className="size-6"/></button>
  </header>
  {yearMode?<div className="min-h-0 flex-1 overflow-y-auto px-3 py-4">
   <div className="mb-4 flex items-center justify-between">
    <button type="button" aria-label={copy('previousYear')} onClick={()=>changeYear(year-1)} className={action}><ChevronLeft aria-hidden="true" className="size-5"/></button>
    <h1 className="text-2xl font-bold">{year}</h1>
    <button type="button" aria-label={copy('nextYear')} onClick={()=>changeYear(year+1)} className={action}><ChevronRight aria-hidden="true" className="size-5"/></button>
   </div>
   <div className="mx-auto grid max-w-xl grid-cols-[repeat(auto-fit,minmax(min(100%,max(7rem,calc((100%_-_1rem)/3))),1fr))] gap-2">
    {Array.from({length:12},(_,month)=><button key={month} type="button" onClick={()=>jump(calendarDate(year,month,1))} className="min-h-16 min-w-0 break-words rounded-xl border border-[var(--mroya-divider)] bg-[var(--mroya-surface)] p-2 text-center text-sm font-medium capitalize">{monthName(month)}</button>)}
   </div>
  </div>:<div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3" ref={scroll}>
   {months.map(month=><section key={month.key} data-mobile-month={month.key} className="mx-auto max-w-xl border-b border-[var(--mroya-divider)] py-4">
     <h2 className="mb-2 text-2xl font-bold capitalize">{month.name}</h2>
     <div className="grid grid-cols-7">
      {oneWeek.map((day,i)=><div key={i} className="truncate pb-1 text-center text-xs text-[var(--mroya-text-muted)]">{day}</div>)}
      {Array.from({length:month.first},(_,i)=><span key={'spacer'+i}/>)}
      {month.days.map(({key,label,number})=>{
       const marked=days.has(key);
       return <button key={key} type="button" data-calendar-date={key} aria-current={key===todayKey?'date':undefined}
         aria-pressed={key===selected}
         aria-label={label+(marked?' · '+copy('hasEvents'):'')}
         onClick={()=>{setSelected(key);if(marked)setPanel('day');}}
         className={'relative mx-auto flex min-h-11 w-full max-w-12 flex-col items-center justify-center rounded-xl text-sm '+(key===selected?'bg-[var(--mroya-primary)] text-[var(--mroya-on-primary)]':key===todayKey?'bg-[var(--mroya-surface-active)] font-bold text-[var(--mroya-primary)]':'hover:bg-[var(--mroya-surface-muted)]')}>
        {number}{marked&&<span aria-hidden="true" className="absolute bottom-1 size-1 rounded-full bg-current"/>}
       </button>;
      })}
     </div>
    </section>)}
  </div>}
  <footer className="flex shrink-0 items-center justify-between border-t border-[var(--mroya-divider)] px-3 pt-1 pb-[max(.25rem,env(safe-area-inset-bottom))]">
   <button type="button" onClick={()=>jump(today)} className={action+' px-2 text-sm font-semibold text-[var(--mroya-primary)]'}>{copy('today')}</button>
   {calendar?.loading&&!events.length&&<span role="status" className="text-xs text-[var(--mroya-text-muted)]">{copy('calendarLoading')}</span>}
   <button type="button" aria-label={copy('upcomingCommitments')} onClick={()=>setPanel('upcoming')} className={action}><CalendarRange aria-hidden="true" className="size-5"/></button>
  </footer>
  {active&&panel&&<DialogFocus onClose={()=>setPanel(null)} role="dialog" aria-modal="true" aria-label={title} tabIndex={-1} className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40">
   <div className="max-h-[80dvh] w-full max-w-xl overflow-y-auto overscroll-contain rounded-t-2xl bg-[var(--mroya-surface)] p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
    <header className="flex items-center justify-between gap-3">
     <h2 className="font-semibold">{title}</h2>
     <button type="button" onClick={()=>setPanel(null)} aria-label={tr('close',{ns:'common'})} className={action}><X aria-hidden="true" className="size-5"/></button>
    </header>
    {panel==='upcoming'&&showGoogle&&<button type="button" onClick={onGoogle} className="my-2 flex w-full items-center gap-3 rounded-xl border border-[var(--mroya-divider)] p-3 text-left">
     <CalendarDays aria-hidden="true" className="size-5 shrink-0 text-[var(--mroya-primary)]"/>
     <span className="min-w-0 flex-1 text-sm"><span className="block font-medium">Google Calendar</span><span className="block break-words text-xs text-[var(--mroya-text-muted)]">{googleStatus}</span></span>
     <ChevronRight aria-hidden="true" className="size-5 shrink-0"/>
    </button>}
    {panel==='upcoming'&&calendar?.upcoming?.error&&<p role="alert" className="py-2 text-sm"><button type="button" onClick={calendar.upcoming.onRetry} className="underline">{copy('retryUpcoming')}</button></p>}
    {!rows.length&&<p className="py-3 text-sm text-[var(--mroya-text-muted)]">{copy(panel==='day'?'noEventsScheduled':calendar?.upcoming?.loading?'checkingUpcoming':'noUpcoming')}</p>}
    <ul className="divide-y divide-[var(--mroya-divider)]">
     {rows.map(event=><li key={event.id}><button type="button" className="block w-full min-w-0 px-2 py-3 text-left hover:bg-[var(--mroya-surface-muted)]" onClick={()=>{setPanel(null);onEvent(event);}}>
      <span className="block truncate font-medium">{event.title}</span>
      <span className="block text-xs text-[var(--mroya-text-muted)]">{panel==='upcoming'&&formatDate(event.date+'T12:00:00Z',{day:'numeric',month:'short'},'UTC')+' · '}{event.time==='All day'?copy('allDay'):event.time}</span>
     </button></li>)}
    </ul>
   </div>
  </DialogFocus>}
 </div>;
}
