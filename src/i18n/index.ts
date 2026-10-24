import i18n from 'i18next';
import {initReactI18next} from 'react-i18next';
import {useSyncExternalStore} from 'react';
import {detectBrowserLanguage,readInitialLanguage,supportedLanguage,type AppLanguage} from './language.ts';
import enCommon from './locales/en/common.json' with {type:'json'};
import enAuth from './locales/en/auth.json' with {type:'json'};
import enSidebar from './locales/en/sidebar.json' with {type:'json'};
import enChat from './locales/en/chat.json' with {type:'json'};
import enCalendar from './locales/en/calendar.json' with {type:'json'};
import enConnections from './locales/en/connections.json' with {type:'json'};
import enMemory from './locales/en/memory.json' with {type:'json'};
import enNotes from './locales/en/notes.json' with {type:'json'};
import enReminders from './locales/en/reminders.json' with {type:'json'};
import enDesign from './locales/en/design.json' with {type:'json'};
import enWorkspace from './locales/en/workspace.json' with {type:'json'};
import ruCommon from './locales/ru/common.json' with {type:'json'};
import ruAuth from './locales/ru/auth.json' with {type:'json'};
import ruSidebar from './locales/ru/sidebar.json' with {type:'json'};
import ruChat from './locales/ru/chat.json' with {type:'json'};
import ruCalendar from './locales/ru/calendar.json' with {type:'json'};
import ruConnections from './locales/ru/connections.json' with {type:'json'};
import ruMemory from './locales/ru/memory.json' with {type:'json'};
import ruNotes from './locales/ru/notes.json' with {type:'json'};
import ruReminders from './locales/ru/reminders.json' with {type:'json'};
import ruDesign from './locales/ru/design.json' with {type:'json'};
import ruWorkspace from './locales/ru/workspace.json' with {type:'json'};
import {LANGUAGE_STORAGE_KEY} from './language.ts';

const designMode=import.meta.env?.MODE!=='production';
const namespaces=['common','auth','sidebar','chat','calendar','connections','memory','notes','reminders','workspace',...(designMode?['design' as const]:[])] as const;
const resources={
  en:{common:enCommon,auth:enAuth,sidebar:enSidebar,chat:enChat,calendar:enCalendar,connections:enConnections,memory:enMemory,notes:enNotes,reminders:enReminders,workspace:enWorkspace,...(designMode?{design:enDesign}:{})},
  ru:{common:ruCommon,auth:ruAuth,sidebar:ruSidebar,chat:ruChat,calendar:ruCalendar,connections:ruConnections,memory:ruMemory,notes:ruNotes,reminders:ruReminders,workspace:ruWorkspace,...(designMode?{design:ruDesign}:{})},
};
export const translationResources=resources;
let initialLanguage:AppLanguage='en';
if(typeof window!=='undefined'){
  let storage:Storage|undefined;
  try{storage=window.localStorage;}catch{/* Browser storage can be disabled. */}
  initialLanguage=readInitialLanguage(window.navigator,storage);
}
export const initialGuestLanguage=initialLanguage;

void i18n.use(initReactI18next).init({
  resources,lng:initialLanguage,fallbackLng:'en',supportedLngs:['en','ru'],ns:[...namespaces],defaultNS:'common',
  keySeparator:false,interpolation:{escapeValue:false},returnEmptyString:false,initAsync:false,
  react:{useSuspense:false},
});

export const appI18n=i18n;
if(typeof document!=='undefined')document.documentElement.lang=initialLanguage;
export function tr(key:string,options?:Record<string,unknown>&{ns?:string}) {
  return i18n.t(key,{...options,defaultValue:options?.defaultValue??key});
}
export const browserLanguage=():AppLanguage=>typeof window==='undefined'?'en':detectBrowserLanguage(window.navigator);
export function setAppLanguage(language:AppLanguage,{persistGuest=false}:{persistGuest?:boolean}={}) {
  void i18n.changeLanguage(language);
  if(typeof document!=='undefined')document.documentElement.lang=language;
  if(persistGuest&&typeof window!=='undefined'){
    try{window.localStorage.setItem(LANGUAGE_STORAGE_KEY,language);}catch{/* Browser storage can be disabled. */}
  }
}
export function useLocale(){
  const language=useSyncExternalStore(
    listener=>{i18n.on('languageChanged',listener);return()=>i18n.off('languageChanged',listener);},
    ()=>supportedLanguage(i18n.resolvedLanguage??i18n.language)??'en',
    ()=> 'en' as AppLanguage,
  );
  return {language,setLanguage:setAppLanguage};
}
