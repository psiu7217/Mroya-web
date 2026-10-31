import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {createServer} from 'vite';
const vite=await createServer({mode:'design',server:{middlewareMode:true},appType:'custom'});
after(()=>vite.close());
const {SpeechInputController,recorderMime}=await vite.ssrLoadModule('/src/hooks/SpeechInputController.ts');
const {appendDictation}=await vite.ssrLoadModule('/src/utils/dictation.ts');
const {MroyaApi}=await vite.ssrLoadModule('/src/api/client.ts');
const {ChatWorkspace}=await vite.ssrLoadModule('/src/components/ChatWorkspace.tsx');
const {setAppLanguage}=await vite.ssrLoadModule('/src/i18n/index.ts');
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};
const settle=async()=>{for(let i=0;i<8;i++)await Promise.resolve();};

function recording(getMedia){
  let stopped=0;
  const track={stop:()=>stopped++,onended:null};
  const stream={getTracks:()=>[track]};
  class Recorder {
    static isTypeSupported(type){return type==='audio/mp4';}
    constructor(stream,options){this.mimeType=options.mimeType;this.state='inactive';}
    start(){this.state='recording';}
    stop(){this.state='inactive';queueMicrotask(()=>{this.ondataavailable?.({data:new Blob(['synthetic'],{type:this.mimeType})});this.onstop?.();});}
  }
  const oldRecorder=globalThis.MediaRecorder,oldNavigator=Object.getOwnPropertyDescriptor(globalThis,'navigator');
  globalThis.MediaRecorder=Recorder;
  Object.defineProperty(globalThis,'navigator',{value:{mediaDevices:{getUserMedia:getMedia??(async()=>stream)}},configurable:true});
  return {stream,track,stopped:()=>stopped,restore(){globalThis.MediaRecorder=oldRecorder;if(oldNavigator)Object.defineProperty(globalThis,'navigator',oldNavigator);else delete globalThis.navigator;}};
}

test('Safari MP4 selection, record, stop, transcribe and append to the latest draft; no send operation',async()=>{
  const device=recording(),reply=deferred();let uploads=0;
  const c=new SpeechInputController(async(blob,signal)=>{uploads++;assert.equal(blob.type,'audio/mp4');assert.equal(signal.aborted,false);return reply.promise;});
  try{
    assert.equal(recorderMime(globalThis.MediaRecorder),'audio/mp4');
    await c.start();assert.equal(c.snapshot().phase,'recording');
    c.stop();await settle();assert.equal(c.snapshot().phase,'transcribing');assert.ok(device.stopped()>0);
    reply.resolve('Cześć!');await settle();
    assert.equal(c.snapshot().phase,'idle');assert.equal(c.snapshot().text,'Cześć!');assert.equal(uploads,1);
    assert.equal(appendDictation('Already typed and edited','Cześć!'),'Already typed and edited Cześć!');
    c.inserted();assert.equal(c.snapshot().text,null);
  }finally{c.cancel();device.restore();}
});

test('cancel during recording never uploads; late microphone permission is released',async()=>{
  const device=recording();let uploads=0;const c=new SpeechInputController(async()=>{uploads++;return 'unexpected';});
  try{await c.start();c.cancel();await settle();assert.equal(uploads,0);assert.ok(device.stopped()>0);assert.equal(c.snapshot().phase,'idle');}
  finally{c.cancel();device.restore();}
  const permission=deferred(),late=recording(()=>permission.promise),other=new SpeechInputController(async()=>{uploads++;return 'unexpected';});
  try{const starting=other.start();other.cancel();permission.resolve(late.stream);await starting;assert.ok(late.stopped()>0);assert.equal(uploads,0);}
  finally{other.cancel();late.restore();}
});

test('cancel/close during transcription aborts request and ignores a late result',async()=>{
  const device=recording(),reply=deferred();let signal;
  const c=new SpeechInputController(async(blob,s)=>{signal=s;return reply.promise;});
  try{await c.start();c.stop();await settle();c.cancel();assert.equal(signal.aborted,true);reply.resolve('stale');await settle();assert.equal(c.snapshot().text,null);assert.equal(c.snapshot().phase,'idle');}
  finally{c.cancel();device.restore();}
});

test('permission failure and recorder failure release microphone and permit retry',async()=>{
  const denied=recording(async()=>{throw new DOMException('Denied','NotAllowedError');});
  const c=new SpeechInputController(async()=> 'text');
  try{await c.start();assert.equal(c.snapshot().error,'permission');assert.equal(c.snapshot().phase,'idle');}
  finally{c.cancel();denied.restore();}
  const device=recording();
  try{await c.start();device.track.onended();assert.equal(c.snapshot().error,'recording');assert.ok(device.stopped()>0);}
  finally{c.cancel();device.restore();}
});

test('two minute timer stops recording and starts only transcription',async(t)=>{
  t.mock.timers.enable({apis:['setTimeout','setInterval','Date']});
  const device=recording();let uploads=0;
  const c=new SpeechInputController(async()=>{uploads++;return 'text';});
  try{await c.start();t.mock.timers.tick(119500);await settle();assert.equal(uploads,1);assert.ok(device.stopped()>0);assert.equal(c.snapshot().text,'text');}
  finally{c.cancel();device.restore();t.mock.timers.reset();}
});

test('multipart uses existing session/CSRF client and never chat/send or a language hint',async()=>{
  const calls=[];
  const api=new MroyaApi(async(path,init)=>{
    calls.push([path,init]);
    return new Response(JSON.stringify(path.endsWith('csrf/')?{csrf_token:'synthetic'}:{text:'Привет!'}),{headers:{'Content-Type':'application/json'}});
  });
  assert.equal(await api.transcribeAudio(new Blob(['audio'],{type:'audio/mp4'})),'Привет!');
  assert.deepEqual(calls.map(([p])=>p),['/api/v1/auth/csrf/','/api/v1/chat/transcriptions/']);
  const init=calls[1][1];assert.equal(init.credentials,'same-origin');assert.equal(init.headers['X-CSRFToken'],'synthetic');
  assert.equal(init.headers['Content-Type'],undefined);assert.ok(init.body instanceof FormData);assert.deepEqual([...init.body.keys()],['file']);
});

test('recording and recognition UI have cancel, localized status and no send control',()=>{
  const noop=()=>{},base={account:{name:'Owner',email:'',isGuest:false},conversation:null,memoriesCount:0,onSendMessage:()=>{throw Error('must not send');},addedActionIds:[],plan:'free',theme:'light'};
  for(const [language,status] of [['ru','Распознаём голос'],['en','Transcribing voice']]){
    setAppLanguage(language);
    const speech={phase:'transcribing',seconds:5,error:null,text:null,onStart:noop,onStop:noop,onCancel:noop,onInserted:noop};
    const processing=renderToStaticMarkup(React.createElement(ChatWorkspace,{...base,speech}));
    assert.ok(processing.includes(status));assert.ok(!processing.includes('type="submit"'));
    const active=renderToStaticMarkup(React.createElement(ChatWorkspace,{...base,speech:{...speech,phase:'recording'}}));
    assert.ok(active.includes('0:05'));assert.ok(!active.includes('type="submit"'));assert.ok(!active.includes('transcribeSend'));
  }
});
