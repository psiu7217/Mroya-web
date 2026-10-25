import type {IntelligenceSource} from './intelligenceApi';
export interface InitialQueueTotals {queue_total:number;calendars:{calendar_id:string;pending:number}[]}
export interface InitialQueueReceipt {added:number;already_queued:number;queue_total:number}
export interface InitialQueuePresentation {
 review?:import('./memoryReview').ReviewPresentation;
 results?:import('./initialResults').InitialResultsPresentation;
 scopeKey:string;sources:IntelligenceSource[];selectedId:string;loading:boolean;busy:boolean;error:string|null;
 totals:InitialQueueTotals|null;receipt:InitialQueueReceipt|null;hasMoreSources:boolean;
 onSelect:(id:string)=>void;onEnqueue:()=>void;onRefresh:()=>void;onMoreSources:()=>void;onSettings:()=>void;
}
