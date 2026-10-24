export type AppLanguage='en'|'ru';
export const LANGUAGE_STORAGE_KEY='mroya.language';

export function supportedLanguage(value:unknown):AppLanguage|null {
  return value==='en'||value==='ru'?value:null;
}

export function detectBrowserLanguage(preferences:{languages?:readonly string[];language?:string}|undefined):AppLanguage {
  const candidates=preferences?.languages?.length?[...preferences.languages]:[preferences?.language??''];
  for(const candidate of candidates){
    const language=candidate.trim().toLowerCase();
    if(language==='ru'||language.startsWith('ru-'))return 'ru';
    if(language==='en'||language.startsWith('en-'))return 'en';
  }
  return 'en';
}

export function readInitialLanguage(
  preferences:{languages?:readonly string[];language?:string}|undefined,
  storage?:Pick<Storage,'getItem'|'setItem'>,
):AppLanguage {
  try {
    const saved=storage?.getItem(LANGUAGE_STORAGE_KEY);
    const language=supportedLanguage(saved)??detectBrowserLanguage(preferences);
    if(!supportedLanguage(saved))storage?.setItem(LANGUAGE_STORAGE_KEY,language);
    return language;
  }catch{
    return detectBrowserLanguage(preferences);
  }
}
