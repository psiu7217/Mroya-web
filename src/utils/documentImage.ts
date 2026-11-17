/** Only authenticated document originals can be opened or shared from Chat. */
export function documentImageId(url:string):string|null {
 return /^\/api\/v1\/documents\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\/original\/$/i.exec(url)?.[1]??null;
}
