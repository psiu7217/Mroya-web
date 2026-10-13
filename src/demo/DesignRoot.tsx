import React, { useState } from 'react';
import { WorkspaceView } from '../pages/WorkspaceView';
import { LoginScreen } from '../components/LoginScreen';
import { useDemoWorkspace } from './useDemoWorkspace';
import { DESIGN_SCENARIOS, designScenario, type DesignScenario } from './scenarios';
import { isProductionHost } from '../providers/mode';
function DesignWorkspace({scenario}:{scenario:DesignScenario}) {
  const viewModel = useDemoWorkspace(scenario === 'empty' ? 'empty' : 'filled');
  return <><WorkspaceView model={viewModel}/>{(scenario === 'loading' || scenario === 'error') && <div role={scenario === 'error' ? 'alert' : 'status'} className="fixed top-16 left-1/2 -translate-x-1/2 z-40 rounded-lg border border-[var(--mroya-divider)] bg-[var(--mroya-surface)] px-5 py-3 shadow-sm">{scenario === 'loading' ? 'Loading your workspace…' : 'Unable to load workspace. Design preview of the error state.'}</div>}</>;
}
export default function DesignRoot() {
  const [scenario, setScenario] = useState<DesignScenario>(() => designScenario(window.location.search));
  if (isProductionHost(window.location.hostname)) return <main role="alert">Design build cannot run on the production host. Use a reviewed Production build.</main>;
  return <>{scenario === 'guest' ? <LoginScreen design pending={false} error={null} onSubmit={async () => setScenario('user')}/> : <DesignWorkspace key={scenario} scenario={scenario}/>}
    <details className="fixed bottom-1 left-1 z-50 text-[10px] text-[var(--mroya-text-muted)] bg-[var(--mroya-surface)] rounded border border-[var(--mroya-divider)] px-2 py-1"><summary className="cursor-pointer">Design states</summary><label>Scenario <select aria-label="Design scenario" value={scenario} onChange={e=>setScenario(e.target.value as DesignScenario)}>{DESIGN_SCENARIOS.map(s=><option key={s}>{s}</option>)}</select></label></details>
  </>;
}
