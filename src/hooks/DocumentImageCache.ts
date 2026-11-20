import {ApiError} from '../api/errors.ts';
import {isTurnUuid} from '../api/reportContext.ts';
import {documentImageStorage,documentImageLifetime,type ImageKey} from './documentImageStorage.ts';

const rasterTypes=new Set(['image/png','image/jpeg','image/webp','image/gif']);
const maxImageBytes=25*1024*1024;
const ignoreStorage=()=>undefined;
const cancelled=()=>new DOMException('Image request cancelled','AbortError');
type OriginalReader=(id:string,signal?:AbortSignal)=>Promise<File>;
type Job={controller:AbortController;promise:Promise<File>;readers:number};

async function digest(file:File){
  const bytes=await crypto.subtle.digest('SHA-256',await file.arrayBuffer());
  return Array.from(new Uint8Array(bytes),byte=>byte.toString(16).padStart(2,'0')).join('');
}

export class DocumentImageCache {
  private scope:AbortController|null=null;
  private ready:Promise<unknown>=Promise.resolve();
  private readonly jobs=new Map<string,Job>();
  private readonly deleted=new Set<string>();

  constructor(private owner:number,private readOriginal:OriginalReader,private expired:()=>void){}

  start=()=>{
    if(this.scope)return;
    this.scope=new AbortController();
    this.ready=documentImageStorage.retainAccount(this.owner,this.scope.signal).catch(ignoreStorage);
  };

  stop=()=>{
    this.scope?.abort();
    this.scope=null;
    for(const job of this.jobs.values())job.controller.abort();
    this.jobs.clear();
  };

  clear=()=>{
    this.stop();
    return documentImageStorage.removeAccount(this.owner).catch(ignoreStorage);
  };

  forget=(id:string)=>{
    id=id.toLowerCase();
    this.deleted.add(id);
    const job=this.jobs.get(id);
    this.jobs.delete(id);
    job?.controller.abort();
    return this.discard(id);
  };

  discard=(id:string)=>documentImageStorage.remove([this.owner,id.toLowerCase()]).catch(ignoreStorage);

  load=(id:string,signal?:AbortSignal):Promise<File>=>{
    if(!isTurnUuid(id))return Promise.reject(new ApiError(400,'invalid_document','Invalid document UUID'));
    id=id.toLowerCase();
    if(!this.scope||signal?.aborted||this.deleted.has(id))return Promise.reject(cancelled());
    let job=this.jobs.get(id);
    if(!job){
      const controller=new AbortController();
      const promise=this.read(id,controller.signal).finally(()=>{
        if(this.jobs.get(id)?.controller===controller)this.jobs.delete(id);
      });
      job={controller,promise,readers:0};
      this.jobs.set(id,job);
    }
    const shared=job;
    shared.readers++;
    return new Promise<File>((resolve,reject)=>{
      const abort=()=>{finish();reject(cancelled());};
      const finish=()=>{
        signal?.removeEventListener('abort',abort);
        shared.controller.signal.removeEventListener('abort',abort);
        shared.readers--;
        if(shared.readers===0&&this.jobs.get(id)===shared){this.jobs.delete(id);shared.controller.abort();}
      };
      signal?.addEventListener('abort',abort,{once:true});
      shared.controller.signal.addEventListener('abort',abort,{once:true});
      shared.promise.then(file=>{
        if(signal?.aborted||shared.controller.signal.aborted)return;
        finish();resolve(file);
      },error=>{
        if(signal?.aborted||shared.controller.signal.aborted)return;
        finish();reject(error);
      });
    });
  };

  private async read(id:string,signal:AbortSignal){
    await this.ready;
    signal.throwIfAborted();
    const key:ImageKey=[this.owner,id];
    const cached=await documentImageStorage.read(key).catch(ignoreStorage);
    signal.throwIfAborted();
    if(cached){
      const file=cached.file;
      const usable=file instanceof File&&file.size>0&&file.size<=maxImageBytes&&rasterTypes.has(file.type)&&
        /^[a-f0-9]{64}$/.test(cached.digest)&&Number.isFinite(cached.expiresAt)&&cached.expiresAt>Date.now()&&
        (await digest(file).catch(ignoreStorage))===cached.digest;
      signal.throwIfAborted();
      if(usable)return file;
      await this.discard(id);
    }
    signal.throwIfAborted();
    try{
      const file=await this.readOriginal(id,signal);
      signal.throwIfAborted();
      const checksum=await digest(file).catch(ignoreStorage);
      signal.throwIfAborted();
      if(checksum){
        const savedAt=Date.now();
        await documentImageStorage.write({key,file,digest:checksum,savedAt,expiresAt:savedAt+documentImageLifetime},signal).catch(ignoreStorage);
      }
      signal.throwIfAborted();
      return file;
    }catch(error){
      if(!signal.aborted&&error instanceof ApiError&&error.status===401)this.expired();
      throw error;
    }
  }
}
