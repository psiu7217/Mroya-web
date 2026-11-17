import type {DocumentDto} from '../types/documents.ts';
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
