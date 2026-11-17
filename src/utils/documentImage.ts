/** Only authenticated document originals can be opened or shared from Chat. */
export function documentImageId(url:string):string|null {
 return /^\/api\/v1\/documents\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\/original\/$/i.exec(url)?.[1]??null;
}

const previewableImageTypes = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif']);
export function isPreviewableDocumentImage(mimeType: string, url: string, id: string): boolean {
 return previewableImageTypes.has(mimeType) && documentImageId(url) === id;
}
