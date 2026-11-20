const databaseName='mroya-document-images';
const storeName='originals';
const maxBytes=64*1024*1024;
export const documentImageLifetime=7*24*60*60*1000;
export type ImageKey=[owner:number,id:string];
export interface StoredDocumentImage {
  key:ImageKey;
  file:File;
  digest:string;
  savedAt:number;
  expiresAt:number;
}

function open(){
  return new Promise<IDBDatabase>((resolve,reject)=>{
    const request=indexedDB.open(databaseName,1);
    request.onupgradeneeded=()=>request.result.createObjectStore(storeName,{keyPath:'key'});
    request.onerror=()=>reject(request.error);
    request.onsuccess=()=>resolve(request.result);
  });
}

async function transact<T>(mode:IDBTransactionMode, run:(store:IDBObjectStore,finish:(value:T)=>void)=>void, signal?:AbortSignal):Promise<T>{
  const db=await open();
  try{
    signal?.throwIfAborted();
    return await new Promise<T>((resolve,reject)=>{
      const tx=db.transaction(storeName,mode);
      const abort=()=>{try{tx.abort();}catch{/* The transaction already finished. */}};
      signal?.addEventListener('abort',abort,{once:true});
      let result:T;
      const finish=()=>signal?.removeEventListener('abort',abort);
      tx.oncomplete=()=>{finish();resolve(result);};
      tx.onabort=()=>{finish();reject(tx.error??signal?.reason);};
      run(tx.objectStore(storeName),value=>{result=value;});
    });
  }finally{db.close();}
}

export const documentImageStorage={
  read:(key:ImageKey)=>transact<StoredDocumentImage|undefined>('readonly',(store,finish)=>{
    const request=store.get(key);
    request.onsuccess=()=>finish(request.result as StoredDocumentImage|undefined);
  }),
  remove:(key:ImageKey)=>transact<void>('readwrite',store=>{store.delete(key);}),
  removeAccount:(owner:number)=>transact<void>('readwrite',store=>{
    const request=store.getAllKeys();
    request.onsuccess=()=>{for(const key of request.result)if((key as ImageKey)[0]===owner)store.delete(key);};
  }),
  retainAccount:(owner:number|null,signal?:AbortSignal)=>transact<void>('readwrite',store=>{
    if(owner===null){store.clear();return;}
    const now=Date.now();
    const request=store.openCursor();
    request.onsuccess=()=>{
      const cursor=request.result;
      if(!cursor)return;
      const entry=cursor.value as StoredDocumentImage;
      if(entry.key[0]!==owner||!Number.isFinite(entry.expiresAt)||entry.expiresAt<=now)cursor.delete();
      cursor.continue();
    };
  },signal),
  write:(entry:StoredDocumentImage,signal:AbortSignal)=>transact<void>('readwrite',store=>{
    const request=store.getAll();
    request.onsuccess=()=>{
      const entries=(request.result as StoredDocumentImage[]).sort((left,right)=>left.savedAt-right.savedAt);
      const retained:StoredDocumentImage[]=[];
      let bytes=entry.file.size;
      for(const saved of entries){
        if(saved.key[0]===entry.key[0]&&saved.key[1]===entry.key[1])continue;
        if(!(saved.file instanceof Blob)||!Number.isFinite(saved.expiresAt)||saved.expiresAt<=entry.savedAt){store.delete(saved.key);continue;}
        bytes+=saved.file.size;
        retained.push(saved);
      }
      for(const saved of retained){
        if(bytes<=maxBytes)break;
        bytes-=saved.file.size;
        store.delete(saved.key);
      }
      store.put(entry);
    };
  },signal),
};
