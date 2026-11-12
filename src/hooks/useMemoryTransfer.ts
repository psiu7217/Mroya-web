import {useCallback, useState} from 'react';
import type {WorkspaceSource} from '../types/source';
import type {MemoryTransferPresentation} from '../types/memoryTransfer';
import {tr} from '../i18n';

export function useMemoryTransfer(source:WorkspaceSource):MemoryTransferPresentation {
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState<string|null>(null);
  const exportMemory=useCallback(()=>{
    if(!source.exportMemory || busy)return;
    setError(null);setBusy(true);
    void source.exportMemory().then(value=>{
      const url=URL.createObjectURL(new Blob([JSON.stringify(value,null,2)],{type:'application/json'}));
      const link=document.createElement('a');
      link.href=url;link.download=`mroya-memory-${new Date().toISOString().slice(0,10)}.json`;
      document.body.append(link);link.click();link.remove();
      setTimeout(()=>URL.revokeObjectURL(url),1000);
    }).catch(()=>setError(tr('memoryExportFailed',{ns:'connections'}))).finally(()=>setBusy(false));
  },[source,busy]);
  return {busy,error,success:false,importAvailable:false,exportMemory,validateFile:async()=>false,importValidatedFile:()=>{}};
}
