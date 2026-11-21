import type {DocumentLibraryPage,DocumentCategoryDto} from '../types/documents';
import type {NotesPage} from '../types/notesApi';

interface Lists {
 files:DocumentLibraryPage;
 folders:DocumentCategoryDto[];
 notes:NotesPage;
}
const prefix='mroya:workspace-lists:v1:';
const names=['files','folders','notes'] as const;
const lifetime=7*24*60*60*1000;
const maximumChars=256*1024;

export function retainWorkspaceLists(owner:number|null) {
 try {
  const previous=localStorage.getItem(prefix+'owner');
  if(previous===String(owner))return;
  for(const list of names)localStorage.removeItem(prefix+list);
  if(owner===null)localStorage.removeItem(prefix+'owner');
  else localStorage.setItem(prefix+'owner',String(owner));
 }catch {/* Browser storage may be unavailable. */}
}

export class WorkspaceListCache {
 private owner:number;
 constructor(owner:number){this.owner=owner;}
 private ownsCache(){return localStorage.getItem(prefix+'owner')===String(this.owner);}
 read<K extends keyof Lists>(name:K):Lists[K]|undefined {
  try {
   if(!this.ownsCache())return;
   const text=localStorage.getItem(prefix+name);
   if(!text||text.length>maximumChars)return;
   const record=JSON.parse(text);
   if(record.owner===this.owner&&record.expires>Date.now())return record.value as Lists[K];
  }catch {/* Use the network when browser storage is unavailable. */}
 }
 write<K extends keyof Lists>(name:K,value:Lists[K]){
  try {
   if(!this.ownsCache())return;
   const text=JSON.stringify({owner:this.owner,expires:Date.now()+lifetime,value});
   if(text.length<=maximumChars)localStorage.setItem(prefix+name,text);
   else localStorage.removeItem(prefix+name);
  }catch {/* The in-memory response remains available if storage is full. */}
 }
 forget(name:keyof Lists){
  try{if(this.ownsCache())localStorage.removeItem(prefix+name);}catch {/* Storage may be unavailable. */}
 }
}
