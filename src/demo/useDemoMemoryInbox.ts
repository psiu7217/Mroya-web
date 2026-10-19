import {useState} from 'react';
import {INITIAL_PROPOSALS} from './memoryInboxFixtures';
import type {InboxProposal,InboxPreviewFilter,MemoryInboxPresentation} from '../types/memoryInbox';

// Offline preview only. Never writes to canonical memory or claims a server result.
export function useDemoMemoryInbox():MemoryInboxPresentation {
  const [proposals,setProposals]=useState<InboxProposal[]>(()=>structuredClone(INITIAL_PROPOSALS));
  const [revision,setRevision]=useState(0);
  const [filter,setFilter]=useState<InboxPreviewFilter>('all');
  const update=(id:string,change:Partial<InboxProposal>)=>setProposals(previous=>previous.map(p=>p.id===id?{...p,...change}:p));
  return {
    available:true,scopeKey:`design-memory-inbox-${revision}`,proposals,loading:filter==='loading',error:null,
    onAcceptProposal:id=>update(id,{status:'applied',isConfirmed:true}),
    onRejectProposal:id=>update(id,{status:'declined',isConfirmed:false}),
    onCommentProposal:(id,comment)=>update(id,{status:'reanalyzing',comment}),
    onRetryProposal:id=>{if(id)update(id,{status:'reanalyzing',errorMessage:undefined});},
    preview:{filter,onSelectFilter:setFilter,onReset:()=>{setRevision(value=>value+1);setProposals(structuredClone(INITIAL_PROPOSALS));setFilter('all');},
      commentPlaceholder:'Например: «Марк — мой сын» или «Дмитрий и Татьяна Мурашко — мои друзья»...',
      filters:[
        {id:'all',label:`Все (${proposals.length})`},
        {id:'new',label:`Новые (${proposals.filter(p=>p.status==='new').length})`},
        {id:'reanalyzing',label:'Повторный анализ'},{id:'accepted',label:'Принято'},
        {id:'declined',label:'Отклонено'},{id:'applied',label:'Успешно применено'},
        {id:'outdated',label:'Устаревшее'},{id:'error',label:'Ошибка'},
        {id:'empty',label:'Пустой Inbox'},{id:'loading',label:'Загрузка'},
      ]},
  };
}
