import {MroyaApi} from '../api/client.ts';
import {ApiError} from '../api/errors.ts';
import type {WorkspaceSource,SessionState} from '../types/source.ts';
export function createLiveSource(api=new MroyaApi()):WorkspaceSource {
  return {
    kind:'live',
    timezone:{
      initializeIfUnset:(timezone,signal)=>api.savePreferences({timezone,timezone_only_if_unset:true},signal),
      save:(timezone,signal)=>api.savePreferences({timezone},signal),
    },
    calendarEvents:(start,end,offset,signal)=>api.calendarEvents(start,end,offset,signal),
    calendarEvent:(id,signal)=>api.calendarEvent(id,signal),
    mutateCalendar:(method,id,body,signal)=>api.mutateCalendar(method,id,body,signal),
    googleCalendarConnections:signal=>api.googleCalendarConnections(signal),
    startCalendarGoogle:(id,signal)=>api.startCalendarGoogle(id,signal),
    configureCalendarGoogle:(id,changes,signal)=>api.configureCalendarGoogle(id,changes,signal),
    syncCalendarGoogle:(id,signal)=>api.syncCalendarGoogle(id,signal),
    disconnectCalendarGoogle:(id,signal)=>api.disconnectCalendarGoogle(id,signal),
    conversations:(offset,signal)=>api.conversations(offset,signal),
    createConversation:signal=>api.createConversation(signal),
    renameConversation:(id,title,signal)=>api.renameConversation(id,title,signal),
    deleteConversation:(id,signal)=>api.deleteConversation(id,signal),
    conversationHistory:(id,before,signal)=>api.conversationHistory(id,before,signal),
    sendConversation:(id,content,submissionId,onEvent,options)=>api.sendConversation(id,content,submissionId,onEvent,options),
    session:async(signal):Promise<SessionState>=>{try{return {status:'authenticated',user:(await api.me(signal)).user};}catch(error){if(error instanceof ApiError&&error.status===401)return {status:'guest'};throw error;}},
    login:(username,password,signal)=>api.login(username,password,signal),logout:signal=>api.logout(signal),
    savePreferences:(changes,signal)=>api.savePreferences(changes,signal),refreshCsrf:signal=>api.csrf(signal),
    history:(before,signal)=>api.history(before,signal),memories:(options,signal)=>api.memories(options,signal),map:signal=>api.map(signal),capabilities:signal=>api.capabilities(signal),
    send:(content,id,onEvent,options)=>api.send(content,id,onEvent,options),turn:(id,signal)=>api.turn(id,signal),
    telegramStatus:signal=>api.telegramStatus(signal),
    createTelegramLink:signal=>api.createTelegramLink(signal),
    disconnectTelegram:signal=>api.disconnectTelegram(signal),
    reportChatIssue:(context,signal)=>api.reportChatIssue(context,signal),
    getChatErrorReport:(turnId,signal)=>api.getChatErrorReport(turnId,signal),
    getFullChatErrorReport:(turnId,signal)=>api.getFullChatErrorReport(turnId,signal),
    startGoogleAuth:signal=>api.startGoogleAuth(signal),
  };
}
