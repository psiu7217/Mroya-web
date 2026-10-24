export interface MemoryLink {space_uuid:string;object_uuid:string}
export interface MemoryLinkTarget {nodeId:string;label:string}
export interface MemoryLinksNavigation {targets:Record<string,MemoryLinkTarget>;onOpen:(nodeId:string)=>void}
