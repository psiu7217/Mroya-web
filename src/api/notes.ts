import {ApiError} from './errors.ts';
import {isTurnUuid} from './reportContext.ts';
import type {NoteSummaryDto,NoteDetailDto,NotesPage} from '../types/notesApi.ts';
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const text=(v:unknown,max:number):v is string=>typeof v==='string'&&Array.from(v).length<=max;
const date=(v:unknown):v is string=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}T/.test(v)&&Number.isFinite(Date.parse(v));
const words=(v:unknown,count:number,size:number):v is string[]=>Array.isArray(v)&&v.length<=count&&v.every(w=>text(w,size));
function invalid():never{throw new ApiError(502,'invalid_response','Invalid Notes response');}
export function noteId(id:string){if(!isTurnUuid(id))throw new ApiError(400,'invalid_note','Invalid note UUID');return id;}
function summary(v:unknown):NoteSummaryDto {
 if(!object(v)||!isTurnUuid(v.id)||!isTurnUuid(v.space_uuid)||!text(v.title,240)||!text(v.summary,1200)
  ||!words(v.keywords,12,80)||!words(v.search_phrases,10,160)||!Number.isSafeInteger(v.version)||(v.version as number)<1
  ||!['pending','synced','error'].includes(v.sync_status as string)||!date(v.created_at)||!date(v.updated_at))invalid();
 return {id:v.id,space_uuid:v.space_uuid,title:v.title,summary:v.summary,keywords:[...v.keywords],search_phrases:[...v.search_phrases],
  version:v.version as number,sync_status:v.sync_status as NoteSummaryDto['sync_status'],created_at:v.created_at,updated_at:v.updated_at};
}
export function readNotesPage(v:unknown,offset:number):NotesPage {
 if(!object(v)||v.limit!==20||v.offset!==offset||typeof v.has_more!=='boolean'||!Array.isArray(v.notes)||v.notes.length>20||v.has_more&&v.notes.length!==20)invalid();
 const notes=v.notes.map(summary);if(new Set(notes.map(n=>n.id)).size!==notes.length)invalid();
 return {notes,limit:20,offset,has_more:v.has_more};
}
export function readNoteDetail(v:unknown,id:string):NoteDetailDto {
 if(!object(v)||!object(v.note))invalid();const n=v.note,s=summary(n);
 if(s.id!==id||!text(n.content,20000)||!Array.isArray(n.memory_links)||n.memory_links.length>8)invalid();
 const links=n.memory_links.map(link=>{if(!object(link)||link.space_uuid!==s.space_uuid||!isTurnUuid(link.object_uuid))invalid();return {space_uuid:s.space_uuid,object_uuid:link.object_uuid as string};});
 return {...s,content:n.content,memory_links:links};
}
