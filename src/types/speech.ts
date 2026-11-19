export type SpeechPhase='idle'|'requesting'|'recording'|'transcribing';
export interface SpeechPresentation {
  phase:SpeechPhase; seconds:number; level:number; error:string|null; text:string|null; sendOnInsert:boolean;
  onStart:()=>void; onStop:(sendImmediately?:boolean)=>void; onCancel:()=>void; onInserted:()=>void;
}
