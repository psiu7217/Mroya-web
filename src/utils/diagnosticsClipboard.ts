// Start write() in the click stack; resolve only the fetched, validated server text later.
export function copyDiagnosticText(load:()=>Promise<string>,active:()=>boolean=()=>true):Promise<void>{
 const clipboard=typeof navigator==='undefined'?undefined:navigator.clipboard;
 const current=()=>{if(!active())throw new DOMException('Cancelled','AbortError');};
 if(!clipboard)return Promise.reject(new Error('Clipboard unavailable'));
 if(typeof clipboard.write==='function'&&typeof ClipboardItem!=='undefined'){
  const data=Promise.resolve().then(()=>{current();return load();}).then(text=>{current();return new Blob([text],{type:'text/plain'});});
  void data.catch(()=>{}); // A browser may reject before consuming the promised Blob.
  try{
   const write=clipboard.write([new ClipboardItem({'text/plain':data})]);
   return Promise.all([write,data]).then(()=>{current();});
  }catch(error){return Promise.reject(error);}
 }
 if(typeof clipboard.writeText==='function')
  return Promise.resolve().then(()=>{current();return load();}).then(text=>{current();return clipboard.writeText(text);}).then(()=>{current();});
 return Promise.reject(new Error('Clipboard unavailable'));
}
