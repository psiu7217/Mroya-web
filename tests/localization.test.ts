import test from 'node:test';
import assert from 'node:assert/strict';
import {detectBrowserLanguage,readInitialLanguage,LANGUAGE_STORAGE_KEY} from '../src/i18n/language.ts';
import {appI18n,setAppLanguage,translationResources} from '../src/i18n/index.ts';
import {inboxStatusLabel,runtimeNotice} from '../src/hooks/inboxAdapters.ts';

test('browser language follows ordered supported preferences and regional tags',()=>{
 assert.equal(detectBrowserLanguage({languages:['fr-CA','ru-RU','en-US']}),'ru');
 assert.equal(detectBrowserLanguage({languages:['en-GB','ru-RU']}),'en');
 assert.equal(detectBrowserLanguage({languages:[],language:'ru'}),'ru');
 assert.equal(detectBrowserLanguage({language:'ru'}),'ru');
 assert.equal(detectBrowserLanguage({languages:['fr-FR'],language:'ru-RU'}),'en');
 assert.equal(detectBrowserLanguage({language:'fr-FR'}),'en');
});

test('guest language is stored once and reused on the next visit',()=>{
 const values=new Map<string,string>();
 const storage={getItem:(key:string)=>values.get(key)??null,setItem:(key:string,value:string)=>{values.set(key,value);}};
 assert.equal(readInitialLanguage({languages:['ru-RU']},storage),'ru');
 assert.equal(values.get(LANGUAGE_STORAGE_KEY),'ru');
 assert.equal(readInitialLanguage({languages:['en-US']},storage),'ru');
});

test('i18next uses safe English fallback and Russian plural forms',async()=>{
 await appI18n.changeLanguage('ru');
 assert.equal(appI18n.t('dayCount',{ns:'calendar',count:1}), '1 день');
 assert.equal(appI18n.t('dayCount',{ns:'calendar',count:2}), '2 дня');
 assert.equal(appI18n.t('dayCount',{ns:'calendar',count:5}), '5 дней');
 assert.equal(appI18n.t('key-that-does-not-exist',{ns:'memory',defaultValue:'key-that-does-not-exist'}), 'key-that-does-not-exist');
 await appI18n.changeLanguage('en');
 assert.equal(appI18n.t('dayCount',{ns:'calendar',count:2}), '2 days');
 assert.equal(appI18n.t('googleSyncAttention',{ns:'connections',count:1}), 'Synchronization needs attention (1 issue).');
 await appI18n.changeLanguage('ru');
 assert.equal(appI18n.t('googleSyncAttention',{ns:'connections',count:2}), 'Требует внимания: 2 проблемы.');
 assert.equal(appI18n.t('googleSyncAttention',{ns:'connections',count:5}), 'Требует внимания: 5 проблем.');
 assert.equal(appI18n.t('googleSyncAttention',{ns:'connections',count:21}), 'Требует внимания: 21 проблема.');
 setAppLanguage('en');
});

test('Memory Inbox hook adapters update status and runtime copy immediately when locale changes',async()=>{
 setAppLanguage('en');
 const capabilities={stage:'',inbox:true,deep_analysis:false,memory_apply:false,auto_link:false,auto_write:false} as never;
 const runtime={worker_enabled:false,deep_enabled:false,apply_enabled:false} as never;
 assert.equal(inboxStatusLabel('pending'),'Awaiting decision');
 assert.match(runtimeNotice(capabilities,runtime),/Background processing is disabled/);
 await appI18n.changeLanguage('ru');
 assert.equal(inboxStatusLabel('pending'),'Ожидает решения');
 assert.match(runtimeNotice(capabilities,runtime),/Фоновая обработка выключена/);
 setAppLanguage('en');
});

test('English and Russian dictionaries cover the same keys and contain no blank translations',()=>{
 const en=translationResources.en as Record<string,Record<string,string>>;
 const ru=translationResources.ru as Record<string,Record<string,string>>;
 for(const namespace of Object.keys(en)){
  const normalize=(key:string)=>key.replace(/_(zero|one|two|few|many|other)$/,'');
  const englishKeys=[...new Set(Object.keys(en[namespace]).map(normalize))].sort();
  const russianKeys=[...new Set(Object.keys(ru[namespace]).map(normalize))].sort();
  assert.deepEqual(russianKeys,englishKeys,`Dictionary key mismatch in ${namespace}`);
  assert.ok(Object.values(en[namespace]).every(value=>value.trim().length>0),`Blank English translation in ${namespace}`);
  assert.ok(Object.values(ru[namespace]).every(value=>value.trim().length>0),`Blank Russian translation in ${namespace}`);
 }
});
