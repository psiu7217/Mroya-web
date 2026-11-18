export type SpeechPhase='idle'|'requesting'|'recording'|'transcribing';
export interface SpeechPresentation {
  phase:SpeechPhase; seconds:number; error:string|null; text:string|null;
  onStart:()=>void; onStop:()=>void; onCancel:()=>void; onInserted:()=>void;
}
