// Interactive offline adapter; the exact same Studio components render inert Production examples.
import React from 'react';
import {EventAnalysisPreview,IntelligenceSourcesPreview,IntelligenceAutonomyPreview} from '../components/IntelligencePreviews';
import type {DesignIntelligencePreviews} from '../types/workspace';
export const designIntelligence:DesignIntelligencePreviews={
 EventAnalysis:({event,onOpenMemory})=><EventAnalysisPreview preview={false} event={event}
  variant={event.id==='evt-annas-birthday'?'unavailable':event.id==='evt-oct19-daniel'?'queued':event.id==='evt-oct14-alex'?'conflict':'standard'}
  onViewProposal={()=>onOpenMemory('mem-schedule-pref')}/>,
 Sources:()=> <IntelligenceSourcesPreview preview={false} calendars={[
 {id:'work',name:'Рабочий календарь (Work)',desc:'Встречи, клиенты, спринты и договоренности',defaultActive:true},
 {id:'personal',name:'Личный календарь (Personal)',desc:'Личные планы, тренировки и частные дела',defaultActive:false},
 {id:'holidays',name:'Праздники и контакты',desc:'Дни рождения и государственные праздники',defaultActive:false},
 ]}/>,
 Autonomy:()=> <IntelligenceAutonomyPreview preview={false}/>,
};
