import type {MemoryMapResponse} from '../types/api.ts';
import type {MemoryLinkTarget} from '../types/memoryLinks.ts';
/** Only labels/IDs already returned by the authenticated, owner-scoped reader. No UUID lookups. */
export function memoryLinkTargets(map:MemoryMapResponse):Record<string,MemoryLinkTarget>{
 return Object.fromEntries(map.nodes.filter(n=>n.type==='entity'&&/^entity:[0-9a-f-]{36}$/i.test(n.id)&&typeof n.label==='string'&&n.label.trim()).map(n=>[n.id.slice(7),{nodeId:n.id,label:n.label}]));
}
