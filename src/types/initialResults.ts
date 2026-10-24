export type InitialDecision='APPROVE'|'REJECT';
export interface InitialFilterResults {
 summary:{total:number;pending:number;processing:number;approved:number;rejected:number;errors:number};
 is_complete:boolean;processing_enabled:boolean;
 results:{event_id:string;title:string;calendar_name:string;date:string;decision:InitialDecision;probability:number;model:string;processed_at:string}[];
 next_offset:number|null;
}
export interface InitialResultsState {data:InitialFilterResults|null;decision:InitialDecision;offset:number;loading:boolean;error:string|null}
export interface InitialResultsPresentation extends InitialResultsState {
 onDecision:(decision:InitialDecision)=>void;onRefresh:()=>void;onNext:()=>void;onPrevious:()=>void;
}
