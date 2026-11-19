import {ApiError} from '../api/errors.ts';
import type {SpeechPresentation} from '../types/speech.ts';
type Snapshot=Omit<SpeechPresentation,'onStart'|'onStop'|'onCancel'|'onInserted'>;
export const AUDIO_LIMIT=12*1024*1024;
export function recorderMime(Recorder:typeof MediaRecorder):string|undefined {
  return ['audio/webm;codecs=opus','audio/mp4','audio/webm','audio/ogg;codecs=opus','audio/ogg']
    .find(type=>Recorder.isTypeSupported(type));
}

export class SpeechInputController {
  private state:Snapshot={phase:'idle',seconds:0,level:0,error:null,text:null,sendOnInsert:false};
  private listeners=new Set<()=>void>();
  private generation=0;
  private recorder:MediaRecorder|null=null;
  private stream:MediaStream|null=null;
  private audioContext:AudioContext|null=null;
  private levelTimer:ReturnType<typeof setInterval>|undefined;
  private timer:ReturnType<typeof setInterval>|undefined;
  private limitTimer:ReturnType<typeof setTimeout>|undefined;
  private request:AbortController|null=null;
  constructor(private transcribe:(audio:Blob,signal:AbortSignal)=>Promise<string>,private expired:()=>void=()=>{}){}
  snapshot=()=>this.state;
  subscribe=(listener:()=>void)=>{this.listeners.add(listener);return ()=>{this.listeners.delete(listener);};};
  private update(patch:Partial<Snapshot>){this.state={...this.state,...patch};this.listeners.forEach(listener=>listener());}
  private openAudioContext(){
    if(typeof AudioContext==='undefined')return;
    try{
      this.audioContext=new AudioContext();
      void this.audioContext.resume().catch(()=>{});
    }catch{/* Recording can continue without a level meter. */}
  }
  private measureLevel(stream:MediaStream){
    const context=this.audioContext;
    if(!context)return;
    try{
      const analyser=context.createAnalyser();
      context.createMediaStreamSource(stream).connect(analyser);
      const samples=new Float32Array(analyser.fftSize);
      this.levelTimer=setInterval(()=>{
        analyser.getFloatTimeDomainData(samples);
        let sumOfSquares=0;
        for(const sample of samples)sumOfSquares+=sample*sample;
        const rms=Math.sqrt(sumOfSquares/samples.length);
        const level=Math.max(0,Math.min(1,(20*Math.log10(rms)+60)/60));
        this.update({level});
      },80);
    }catch{/* Recording can continue without a level meter. */}
  }
  private release(){
    clearInterval(this.timer);clearInterval(this.levelTimer);clearTimeout(this.limitTimer);
    if(this.audioContext){void this.audioContext.close().catch(()=>{});this.audioContext=null;}
    this.stream?.getTracks().forEach(track=>{track.onended=null;track.stop();});this.stream=null;
  }
  cancel=()=>{
    this.generation++;this.request?.abort();this.request=null;
    if(this.recorder){const recorder=this.recorder;this.recorder=null;recorder.onstop=null;recorder.ondataavailable=null;recorder.onerror=null;try{if(recorder.state!=='inactive')recorder.stop();}catch{/* The OS may already have released the device. */}}
    this.release();this.update({phase:'idle',seconds:0,level:0,error:null,text:null,sendOnInsert:false});
  };
  inserted=()=>this.update({text:null,sendOnInsert:false});
  private fail(code:string){this.cancel();this.update({error:code});}
  start=async()=>{
    if(this.state.phase!=='idle')return;
    this.cancel();const generation=this.generation;
    if(typeof MediaRecorder==='undefined'||!globalThis.navigator?.mediaDevices?.getUserMedia){this.fail('unsupported');return;}
    this.update({phase:'requesting'});
    this.openAudioContext();
    try{
      const stream=await navigator.mediaDevices.getUserMedia({audio:true});
      if(generation!==this.generation){stream.getTracks().forEach(track=>track.stop());return;}
      this.stream=stream;
      const mimeType=recorderMime(MediaRecorder);
      const recorder=new MediaRecorder(stream,{...(mimeType?{mimeType}:{}),audioBitsPerSecond:64000});
      this.recorder=recorder;let chunks:Blob[]=[],size=0;
      recorder.ondataavailable=event=>{
        if(generation!==this.generation)return;
        size+=event.data.size;
        if(size>AUDIO_LIMIT){chunks=[];this.fail('audio_too_large');return;}
        if(event.data.size)chunks.push(event.data);
      };
      recorder.onerror=()=>{if(generation===this.generation)this.fail('recording');};
      recorder.onstop=()=>{
        if(generation!==this.generation)return;
        this.recorder=null;this.release();
        const audio=new Blob(chunks,{type:recorder.mimeType||chunks[0]?.type});chunks=[];
        if(!audio.size){this.fail('speech_empty');return;}
        void this.recognize(audio,generation);
      };
      stream.getTracks().forEach(track=>{track.onended=()=>{if(generation===this.generation)this.fail('recording');};});
      recorder.start(1000);this.update({phase:'recording'});
      this.measureLevel(stream);
      const started=Date.now();
      this.timer=setInterval(()=>this.update({seconds:Math.min(120,Math.floor((Date.now()-started)/1000))}),250);
      this.limitTimer=setTimeout(this.stop,119500);
    }catch(error){
      if(generation!==this.generation)return;
      this.fail(error instanceof Error&&['NotAllowedError','SecurityError'].includes(error.name)?'permission':'recording');
    }
  };
  stop=(sendImmediately=false)=>{
    if(!this.recorder||this.state.phase!=='recording')return;
    this.update({phase:'transcribing',level:0,sendOnInsert:sendImmediately});
    try{this.recorder.stop();}catch{this.fail('recording');return;}
    this.release();
  };
  private async recognize(audio:Blob,generation:number){
    this.update({phase:'transcribing'});
    const request=new AbortController();this.request=request;
    const timeout=setTimeout(()=>request.abort(),60000);
    try{
      const text=await this.transcribe(audio,request.signal);
      if(generation===this.generation)this.update({phase:'idle',seconds:0,text});
    }catch(error){
      if(generation!==this.generation)return;
      if(error instanceof ApiError&&error.status===401)this.expired();
      this.fail(request.signal.aborted?'speech_timeout':error instanceof ApiError?error.code:'network');
    }finally{clearTimeout(timeout);if(this.request===request)this.request=null;}
  }
}
