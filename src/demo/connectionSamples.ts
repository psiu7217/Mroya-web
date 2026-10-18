import type {ConnectionSamples} from '../types/workspace';

// Imported only by the Design entry graph. Shared UI receives this data through props.
export function connectionSamples(email:string):ConnectionSamples {
  return {
    googleCalendarId:'conn-gcal',
    telegramId:'conn-telegram',
    calendars:[
      {id:'primary',name:`Primary / Основной (${email})`,desc:'General schedule, appointments, personal commitments',available:true,read_only:false,exportable:true},
      {id:'work',name:'Work & Retainers (Работа и клиенты)',desc:'Harbor Labs, Nordic Studio, client calls',available:true,read_only:false,exportable:true},
      {id:'personal',name:'Family & Birthdays (Личное и праздники)',desc:'Family events, contacts birthdays',available:true,read_only:false,exportable:false},
    ],
    scenarios:[
      {id:'disconnected',label:'Disconnected'},
      {id:'connecting',label:'Connecting'},
      {id:'initial_syncing',label:'Initial sync'},
      {id:'connected_auto_off',label:'Connected (Auto OFF)'},
      {id:'connected_auto_on',label:'Connected (Auto ON)'},
      {id:'syncing',label:'Syncing'},
      {id:'sync_error',label:'Sync error'},
      {id:'conflict',label:'Conflict'},
      {id:'reconnect_required',label:'Reconnect required'},
    ],
  };
}
