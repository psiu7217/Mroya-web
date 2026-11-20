import React,{createContext,useContext} from 'react';
import {Menu} from 'lucide-react';
import {tr} from '../i18n';

export const WorkspaceMenuContext=createContext<{open:boolean;onOpen:()=>void}|null>(null);

export function WorkspaceMenuButton(){
  const navigation=useContext(WorkspaceMenuContext);
  if(!navigation)return null;
  return <button type="button" data-workspace-menu-trigger aria-label={tr('openNavigation',{ns:'common'})}
    aria-expanded={navigation.open} aria-controls={navigation.open?'mroya-mobile-navigation':undefined}
    onClick={event=>{event.currentTarget.focus({preventScroll:true});navigation.onOpen();}}
    className="inline-flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-lg text-[var(--mroya-text-muted)] hover:bg-[var(--mroya-surface-muted)] hover:text-[var(--mroya-text)] lg:hidden">
    <Menu aria-hidden="true" className="size-5"/>
  </button>;
}
