import {useCallback, useEffect, useRef, useState} from 'react';
import type {WorkspaceSource} from '../types/source';
import type {MemoryTransferPresentation} from '../types/memoryTransfer';
import {tr} from '../i18n';
import {ApiError} from '../api/errors';
import {memoryExportErrorKey} from './memoryExportError';

function errorMessage(error:unknown,fallback:string):string {
  const map:Record<string,string>={memory_changed_since_export:'memoryChanged',memory_object_referenced:'memoryReferenced',memory_conflict:'memoryConflict',invalid_memory_document:'memoryInvalid',invalid_json:'memoryInvalid',request_too_large:'memoryFileTooLarge',memory_busy:'memoryBusy',memory_import_unavailable:'memoryImportUnavailable'};
  return tr(error instanceof ApiError?(map[error.code]??fallback):'memoryImportUnknown',{ns:'connections'});
}

export function useMemoryTransfer(source:WorkspaceSource,onChanged:()=>void,enabled:boolean):MemoryTransferPresentation {
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState<string|null>(null);
  const [importAvailable,setImportAvailable]=useState(false);
  const [writesAvailable,setWritesAvailable]=useState(false);
  const [searchPending,setSearchPending]=useState(false);
  const [success,setSuccess]=useState(false);
  const [restored,setRestored]=useState(false);
  const [backupId,setBackupId]=useState<string|null>(null);
  const documentRef=useRef<string|null>(null);
  const inFlight=useRef(false);
  useEffect(()=>{
    if(!enabled||!source.memoryTransferStatus)return;
    const abort=new AbortController();
    void source.memoryTransferStatus(abort.signal).then(status=>{
      if(!abort.signal.aborted){setSearchPending(status.searchPending);setBackupId(status.backupId);setImportAvailable(status.importAvailable);setWritesAvailable(status.importAvailable);}
    }).catch(()=>{});
    return ()=>abort.abort();
  },[source,enabled]);
  const exportMemory=useCallback(()=>{
    if(!source.exportMemory || busy)return;
    setError(null);setBusy(true);
    void source.exportMemory().then(value=>{
      const url=URL.createObjectURL(new Blob([JSON.stringify(value,null,2)],{type:'application/json'}));
      const link=document.createElement('a');
      link.href=url;link.download=`mroya-memory-${new Date().toISOString().slice(0,10)}.json`;
      document.body.append(link);link.click();link.remove();
      setTimeout(()=>URL.revokeObjectURL(url),1000);
    }).catch(error=>setError(tr(memoryExportErrorKey(error),{ns:'connections'}))).finally(()=>setBusy(false));
  },[source,busy]);
  const validateFile=useCallback(async(file:File)=>{
    setError(null);
    setSuccess(false);setRestored(false);setImportAvailable(false);documentRef.current=null;
    if(file.size>16*1024*1024){setError(tr('memoryFileTooLarge',{ns:'connections'}));return false;}
    if(!source.validateMemory){setError(tr('memoryValidationFailed',{ns:'connections'}));return false;}
    try {
      const text=await file.text();
      const result=await source.validateMemory(text);
      documentRef.current=text;setImportAvailable(result.importAvailable);setWritesAvailable(result.importAvailable);
      return true;
    } catch(error) {
      setError(error instanceof ApiError?errorMessage(error,'memoryValidationFailed'):tr('memoryValidationFailed',{ns:'connections'}));
      return false;
    }
  },[source]);
  const importValidatedFile=useCallback(()=>{
    const text=documentRef.current;
    if(!importAvailable||!text||!source.importMemory||inFlight.current)return;
    inFlight.current=true;setBusy(true);setError(null);setSuccess(false);setRestored(false);
    documentRef.current=null;setImportAvailable(false);
    void source.importMemory(text).then(result=>{
      setBackupId(result.backupId);setSearchPending(!result.searchReady);setSuccess(result.searchReady);onChanged();
    }).catch(error=>setError(errorMessage(error,'memoryImportFailed')))
      .finally(()=>{inFlight.current=false;setBusy(false);});
  },[source,importAvailable,onChanged]);
  const retrySearch=useCallback(()=>{
    if(!source.retryMemoryRebuild||inFlight.current)return;
    inFlight.current=true;setBusy(true);setError(null);
    void source.retryMemoryRebuild().then(()=>{setSearchPending(false);setSuccess(true);onChanged();})
      .catch(()=>setError(tr('memoryRetryFailed',{ns:'connections'})))
      .finally(()=>{inFlight.current=false;setBusy(false);});
  },[source,onChanged]);
  const restorePrevious=useCallback(()=>{
    if(!backupId||!source.restoreMemory||inFlight.current||!window.confirm(tr('memoryRestoreWarning',{ns:'connections'})))return;
    inFlight.current=true;setBusy(true);setError(null);setSuccess(false);
    void source.restoreMemory(backupId).then(result=>{
      setBackupId(null);setRestored(true);setSearchPending(!result.searchReady);setSuccess(result.searchReady);onChanged();
    }).catch(error=>setError(errorMessage(error,'memoryRestoreFailed')))
      .finally(()=>{inFlight.current=false;setBusy(false);});
  },[source,backupId,onChanged]);
  return {busy,error,success,restored,importAvailable,searchPending,retryAvailable:writesAvailable,canRestore:!!backupId&&writesAvailable,exportMemory,validateFile,importValidatedFile,retrySearch,restorePrevious};
}
