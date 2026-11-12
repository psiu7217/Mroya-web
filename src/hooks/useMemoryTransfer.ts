import {useCallback, useState} from 'react';
import type {WorkspaceSource} from '../types/source';
import type {MemoryTransferPresentation} from '../types/memoryTransfer';
import {tr} from '../i18n';
import {ApiError} from '../api/errors';

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
  const validateFile=useCallback(async(file:File)=>{
    setError(null);
    if(file.size>16*1024*1024){setError(tr('memoryFileTooLarge',{ns:'connections'}));return false;}
    if(!source.validateMemory){setError(tr('memoryValidationFailed',{ns:'connections'}));return false;}
    try {
      const text=await file.text();
      await source.validateMemory(text);
      return true;
    } catch(error) {
      const key=error instanceof ApiError ? ({memory_changed_since_export:'memoryChanged',memory_object_referenced:'memoryReferenced',memory_conflict:'memoryConflict',invalid_memory_document:'memoryInvalid',invalid_json:'memoryInvalid',request_too_large:'memoryFileTooLarge',memory_busy:'memoryBusy'} as Record<string,string>)[error.code] : undefined;
      setError(tr(key??'memoryValidationFailed',{ns:'connections'}));
      return false;
    }
  },[source]);
  return {busy,error,success:false,importAvailable:false,exportMemory,validateFile,importValidatedFile:()=>{}};
}
