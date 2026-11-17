import type {DocumentDto,DocumentCategoryDto,DocumentDetail,DocumentLibraryPage} from '../types/documents.ts';
import {ApiError} from './errors.ts';
import {isTurnUuid} from './reportContext.ts';

export function readDocument(value:unknown):DocumentDto {
 const invalid=():never=>{throw new ApiError(502,'invalid_response','Invalid document response');};
 if(!value||typeof value!=='object'||Array.isArray(value))invalid();
 const row=value as Record<string,unknown>;
 if(!isTurnUuid(row.id)||typeof row.filename!=='string'||!row.filename||typeof row.title!=='string'
  ||typeof row.mime_type!=='string'||!Number.isSafeInteger(row.size_bytes)||(row.size_bytes as number)<1
  ||!['queued','processing','ready','needs_attention','failed'].includes(row.status as string)
  ||typeof row.searchable!=='boolean'||typeof row.coverage!=='string'
  ||typeof row.created_at!=='string'||!Number.isFinite(Date.parse(row.created_at))
  ||row.original_url!==`/api/v1/documents/${row.id}/original/`)invalid();
 if(row.keywords!==undefined&&(!Array.isArray(row.keywords)||row.keywords.length>20
  ||row.keywords.some(word=>typeof word!=='string'||!word.trim()||Array.from(word).length>120)))invalid();
 if(row.category!==null){
  if(!row.category||typeof row.category!=='object'||Array.isArray(row.category))invalid();
  const category=row.category as Record<string,unknown>;
  if(!Array.isArray(category.path)||category.path.length<1||category.path.length>8
   ||category.path.some(name=>typeof name!=='string'||!name.trim())
   ||typeof category.search_enabled!=='boolean'||typeof category.effective_search_enabled!=='boolean'
   ||row.searchable!==category.effective_search_enabled)invalid();
 }else if(row.searchable)invalid();
 return row as unknown as DocumentDto;
}

export function readAttachments(value:unknown):DocumentDto[]{
 if(value===undefined)return [];
 if(!Array.isArray(value)||value.length>8)throw new ApiError(502,'invalid_response','Invalid file attachments');
 const rows=value.map(readDocument);
 if(new Set(rows.map(row=>row.id)).size!==rows.length)throw new ApiError(502,'invalid_response','Duplicate file attachment');
 return rows;
}

function record(value:unknown):Record<string,unknown>{
 if(!value||typeof value!=='object'||Array.isArray(value))throw new ApiError(502,'invalid_response','Invalid file library response');
 return value as Record<string,unknown>;
}
function requireValue(valid:boolean):asserts valid {if(!valid)throw new ApiError(502,'invalid_response','Invalid file library response');}
export function readDocumentCategory(value:unknown):DocumentCategoryDto {
 const c=record(value);
 requireValue(isTurnUuid(c.id)&&(c.parent_id===null||isTurnUuid(c.parent_id))&&typeof c.name==='string'&&!!c.name.trim()
  &&Array.isArray(c.path)&&c.path.length>0&&c.path.length<=8&&c.path.every(p=>typeof p==='string'&&!!p.trim())
  &&typeof c.search_enabled==='boolean'&&typeof c.effective_search_enabled==='boolean'
  &&['model','user'].includes(c.policy_source as string)&&Number.isSafeInteger(c.version)&&(c.version as number)>0);
 return c as unknown as DocumentCategoryDto;
}
export function readDocumentCategories(value:unknown):DocumentCategoryDto[]{
 const r=record(value);requireValue(Array.isArray(r.categories));
 const rows=(r.categories as unknown[]).map(readDocumentCategory),ids=new Set(rows.map(c=>c.id));
 requireValue(ids.size===rows.length&&rows.every(c=>c.parent_id===null||ids.has(c.parent_id)));
 for(const c of rows){let node:DocumentCategoryDto|undefined=c;const seen=new Set<string>();
  while(node){requireValue(!seen.has(node.id)&&seen.size<8);seen.add(node.id);node=rows.find(p=>p.id===node!.parent_id);}}
 return rows;
}
export function readDocumentPage(value:unknown,offset=0):DocumentLibraryPage {
 const r=record(value);requireValue(Array.isArray(r.documents)&&r.documents.length<=50&&Number.isSafeInteger(r.total)&&(r.total as number)>=0
  &&(r.next_offset===null||r.next_offset===offset+50));
 const documents=(r.documents as unknown[]).map(readDocument);
 requireValue(new Set(documents.map(d=>d.id)).size===documents.length&&(r.total as number)>=documents.length);
 return {documents,next_offset:r.next_offset as number|null,total:r.total as number};
}
export function readDocumentDetail(value:unknown,id:string):DocumentDetail {
 const d=readDocument(value),r=record(value);
 requireValue(d.id===id&&(d.category===null||isTurnUuid(d.category.id))&&typeof r.summary==='string'&&Number.isSafeInteger(r.analysis_version)&&(r.analysis_version as number)>=0
  &&Number.isSafeInteger(r.page_count)&&(r.page_count as number)>=0&&Array.isArray(r.pages)&&r.pages.length===r.page_count
  &&Array.isArray(r.facts)&&Array.isArray(r.values)&&['model','user'].includes(r.analysis_author as string)
  &&typeof r.analysis_model==='string'&&(r.processed_at===null||typeof r.processed_at==='string'&&Number.isFinite(Date.parse(r.processed_at))));
 for(const page of r.pages as unknown[]){const p=record(page);requireValue(Number.isSafeInteger(p.page)&&(p.page as number)>0&&typeof p.text==='string');}
 for(const fact of r.facts as unknown[]){const f=record(fact);requireValue(typeof f.text==='string'&&typeof f.quote==='string'&&Number.isSafeInteger(f.page)&&(f.page as number)>0);}
 for(const value of r.values as unknown[]){const v=record(value);requireValue(typeof v.label==='string'&&typeof v.value==='string'&&typeof v.quote==='string'&&Number.isSafeInteger(v.page)&&(v.page as number)>0
  &&['unit','subject'].every(k=>v[k]===undefined||typeof v[k]==='string')&&(v.observed_on===undefined||v.observed_on===null||typeof v.observed_on==='string'));}
 return {...d,...r} as unknown as DocumentDetail;
}
