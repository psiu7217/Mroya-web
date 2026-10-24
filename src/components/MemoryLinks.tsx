import React from 'react';
import type {MemoryLink,MemoryLinksNavigation} from '../types/memoryLinks';
export function MemoryLinks({links=[],navigation}:{links?:MemoryLink[];navigation?:MemoryLinksNavigation}){
 const unique=[...new Map(links.map(link=>[link.space_uuid+':'+link.object_uuid,link])).values()];
 if(!unique.length)return null;
 const known=[...new Map(unique.flatMap(link=>navigation?.targets[link.object_uuid]?[navigation.targets[link.object_uuid]]:[]).map(target=>[target.nodeId,target])).values()];
 return <div className="pt-3 space-y-2 text-[12.5px] text-[var(--mroya-text-muted)]"><p>Связи с памятью: {unique.length}</p>{known.map(target=><button type="button" key={target.nodeId} onClick={()=>navigation?.onOpen(target.nodeId)} className="mr-3 text-[var(--mroya-primary)] hover:underline">{target.label}</button>)}{known.length<unique.length&&<p>Не все связанные объекты доступны в загруженной карте памяти.</p>}</div>;
}
