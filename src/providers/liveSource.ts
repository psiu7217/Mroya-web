import {MroyaApi} from '../api/client.ts';
import {ApiError} from '../api/errors.ts';
import type {WorkspaceSource,SessionState} from '../types/source.ts';
export function createLiveSource(api=new MroyaApi()):WorkspaceSource {
  return {
    kind:'live',
    session:async(signal):Promise<SessionState>=>{try{return {status:'authenticated',user:(await api.me(signal)).user};}catch(error){if(error instanceof ApiError&&error.status===401)return {status:'guest'};throw error;}},
    login:(username,password,signal)=>api.login(username,password,signal),logout:signal=>api.logout(signal),
    savePreferences:(changes,signal)=>api.savePreferences(changes,signal),refreshCsrf:signal=>api.csrf(signal),
    history:(before,signal)=>api.history(before,signal),memories:(options,signal)=>api.memories(options,signal),map:signal=>api.map(signal),capabilities:signal=>api.capabilities(signal),
    send:(content,id,onEvent,options)=>api.send(content,id,onEvent,options),turn:(id,signal)=>api.turn(id,signal),
    telegramStatus:signal=>api.telegramStatus(signal),
    createTelegramLink:signal=>api.createTelegramLink(signal),
    disconnectTelegram:signal=>api.disconnectTelegram(signal),
    startGoogleAuth:signal=>api.startGoogleAuth(signal),
  };
}
