import {appI18n} from './index.ts';
import type {AppLanguage} from './language.ts';

export function currentLocale():AppLanguage {
  return appI18n.resolvedLanguage==='ru'?'ru':'en';
}

export function monthName(monthIndex:number,style:Intl.DateTimeFormatOptions['month']='long',language=currentLocale()):string {
  return new Intl.DateTimeFormat(language,{month:style,timeZone:'UTC'}).format(new Date(Date.UTC(2024,monthIndex,15)));
}

export function weekdayName(dayIndex:number,style:Intl.DateTimeFormatOptions['weekday']='long',language=currentLocale()):string {
  // 2024-01-01 is Monday. Keep the date stable and format it in UTC.
  return new Intl.DateTimeFormat(language,{weekday:style,timeZone:'UTC'}).format(new Date(Date.UTC(2024,0,1+dayIndex)));
}

export function formatDate(value:Date|number|string,options:Intl.DateTimeFormatOptions={},timeZone?:string,language=currentLocale()):string {
  const date=value instanceof Date?value:new Date(value);
  return new Intl.DateTimeFormat(language,{...options,...(timeZone?{timeZone}:{})}).format(date);
}

export function formatTime(value:Date|number|string,options:Intl.DateTimeFormatOptions={},timeZone?:string,language=currentLocale()):string {
  return formatDate(value,{hour:'2-digit',minute:'2-digit',...options},timeZone,language);
}
