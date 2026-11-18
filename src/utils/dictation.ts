export function appendDictation(draft:string,text:string):string {
  return draft+(draft&&!/\s$/.test(draft)?' ':'')+text;
}
