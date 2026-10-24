import React,{useState} from 'react';
import {GuestWorkspace} from '../pages/GuestWorkspace';
import {useGuestChat} from '../hooks/useGuestChat';
import {useWorkspaceLayout} from '../hooks/useWorkspaceLayout';
import {GUEST_ACCOUNT} from '../hooks/guestConversation';
import {tr} from '../i18n';
import type {GreetingPhase} from '../components/GuestWelcome';
export function GuestExperience({onSignIn,phase:initial,initialMessage}:{onSignIn:()=>void;phase?:GreetingPhase;initialMessage?:string}) {
 const {phase,conversation,send,clear}=useGuestChat(initial,initialMessage),layout=useWorkspaceLayout({guest:true});
 const [notice,setNotice]=useState<string|null>(null);
 const gate=()=>{setNotice('signInToPersonalWorkspace');layout.closeMobile();};
 const newChat=()=>{clear();setNotice(null);};
 return <GuestWorkspace phase={phase} notice={notice?tr(notice,{ns:'auth'}):null} onSignIn={onSignIn} onCloseNotice={()=>setNotice(null)}
 sidebar={{account:GUEST_ACCOUNT,onSignIn,activeSection:'chat',onSelectSection:s=>s==='chat'?setNotice(null):gate(),conversations:[],activeConversationId:null,onSelectConversation:gate,onNewChat:newChat,plan:'free',onTogglePlan:gate,onOpenPlanModal:gate,theme:layout.appearance,onToggleTheme:layout.toggleTheme,isCollapsed:layout.collapsed,onToggleCollapse:layout.toggleCollapse,mobileOpen:layout.mobile,onCloseMobile:layout.closeMobile,memoriesCount:0,upcomingEventsCount:0,pendingRemindersCount:0,onOpenSettingsTab:gate}}
 chat={{account:GUEST_ACCOUNT,live:true,memoriesCount:0,conversation,onSendMessage:send,onCitationClick:gate,onActionClick:gate,addedActionIds:[],isSidebarCollapsed:layout.collapsed,onExpandSidebar:layout.expand,onOpenMobileMenu:layout.openMobile,isContextPanelOpen:false,onToggleContextPanel:gate,plan:'free',onTogglePlan:gate,onOpenPlanModal:gate,theme:layout.appearance,onToggleTheme:layout.toggleTheme,onNewChat:newChat,onOpenSettingsTab:gate,onUnavailable:gate}}/>;
}
