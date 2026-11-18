import React, { useState } from 'react';
import { WorkspaceView } from '../pages/WorkspaceView';
import { LoginDialog } from '../components/LoginDialog';
import { GuestExperience } from '../providers/GuestExperience';
import { useDemoWorkspace } from './useDemoWorkspace';
import { DESIGN_SCENARIOS, designScenario, type DesignScenario } from './scenarios';
import { isProductionHost } from '../providers/mode';
import {setAppLanguage,tr} from '../i18n';
import {currentLocale} from '../i18n/format';
import type {AppLanguage} from '../types/api';
function DesignWorkspace({scenario,language,onChangeLanguage}:{scenario:DesignScenario;language:AppLanguage;onChangeLanguage:(language:AppLanguage)=>void}) {
  const viewModel = useDemoWorkspace(scenario === 'empty' ? 'empty' : 'filled');
  const [showFeedback,setShowFeedback]=useState(true);
  const feedback=showFeedback&&(scenario==='loading'||scenario==='error')?{loading:scenario==='loading',busy:false,error:scenario==='error'?tr('designErrorPreview',{ns:'workspace'}):null,onRetry:()=>setShowFeedback(false)}:undefined;
  return <WorkspaceView model={{...viewModel,feedback,language,onChangeLanguage}}/>;
}
export default function DesignRoot() {
  const [language,setLanguage]=useState<AppLanguage>(currentLocale);
  const [scenario, setScenario] = useState<DesignScenario>(() => designScenario(window.location.search));
  const [loginOpen,setLoginOpen]=useState(()=>scenario==='guest-login');
  if (isProductionHost(window.location.hostname)) return <main role="alert">{tr('blockedOnProduction',{ns:'design'})}</main>;
  return <>{scenario.startsWith('guest') ? <><GuestExperience key={scenario} phase={scenario==='guest-typing'?'typing':scenario==='guest-welcome'||scenario==='guest-invite'?'ready':undefined} initialMessage={scenario==='guest-invite'?'How can Mroya help me?':undefined} onSignIn={()=>setLoginOpen(true)}/>{(loginOpen||scenario==='guest-login')&&<LoginDialog design pending={false} error={null} onSubmit={async()=>{setLoginOpen(false);setScenario('user');}} onGoogleSignIn={async()=>{setLoginOpen(false);setScenario('user');}} onClose={()=>{setLoginOpen(false);if(scenario==='guest-login')setScenario('guest-welcome');}}/>}</> : <DesignWorkspace key={scenario} scenario={scenario} language={language} onChangeLanguage={next=>{setAppLanguage(next,{persistGuest:true});setLanguage(next);}}/>}
    <details className="fixed bottom-1 left-1 z-50 text-[10px] text-[var(--mroya-text-muted)] bg-[var(--mroya-surface)] rounded border border-[var(--mroya-divider)] px-2 py-1"><summary className="cursor-pointer">{tr('states',{ns:'design'})}</summary><label>{tr('scenario',{ns:'design'})} <select aria-label={tr('scenarioLabel',{ns:'design'})} value={scenario} onChange={e=>{setLoginOpen(false);setScenario(e.target.value as DesignScenario);}}>{DESIGN_SCENARIOS.map(s=><option key={s}>{s}</option>)}</select></label></details>
  </>;
}
