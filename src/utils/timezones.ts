/** Browser discovery is a hint. Only the backend may persist/validate a user's choice. */
export function browserTimezone():string|null {
  try {const zone=Intl.DateTimeFormat().resolvedOptions().timeZone;return typeof zone==='string'&&zone.trim()?zone:null;}catch{return null;}
}
export function timezoneChoices(current:string,draft:string,common:{value:string;label:string}[]=[]):{value:string;label:string}[]{
  let supported:string[]=[];
  try{supported=Intl.supportedValuesOf('timeZone');}catch{/* Older browsers still allow a custom IANA entry. */}
  const values=new Map(common.map(zone=>[zone.value,zone.label]));
  for(const zone of ['UTC',...supported,current,draft])if(zone&&!values.has(zone))values.set(zone,zone);
  return [...values].map(([value,label])=>({value,label}));
}
