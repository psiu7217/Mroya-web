import {applyBrowserTheme} from '../utils/browserTheme.ts';
import {useEffect,useState} from 'react';
import type {ThemeMode} from '../types/mroya';

const GUEST_THEME_KEY='mroya:guest-theme';
export function readGuestTheme():ThemeMode{
  if(typeof window==='undefined')return 'system';
  try{
    const value=window.localStorage.getItem(GUEST_THEME_KEY);
    return value==='light'||value==='dark'||value==='system'?value:'system';
  }catch{return 'system';}
}
export function resolvedTheme(theme:ThemeMode,darkPreferred:boolean):'light'|'dark'{
  return theme==='system'?(darkPreferred?'dark':'light'):theme;
}
export function useWorkspaceLayout(options:{guest?:boolean;theme?:ThemeMode;onThemeChange?:(value:ThemeMode)=>void}={}) {
  const [collapsed,setCollapsed]=useState(false),[mobile,setMobile]=useState(false);
  const [localTheme,setLocalTheme]=useState<ThemeMode>(()=>options.guest?readGuestTheme():options.theme??'light');
  const theme=options.theme??localTheme;
  const [appearance,setAppearance]=useState<'light'|'dark'>(()=>resolvedTheme(theme,typeof window!=='undefined'&&window.matchMedia?.('(prefers-color-scheme: dark)')?.matches===true));
  useEffect(()=>{
    if(typeof window==='undefined')return;
    const media=window.matchMedia?.('(prefers-color-scheme: dark)');
    const apply=()=>{const value=resolvedTheme(theme,media?.matches===true);setAppearance(value);applyBrowserTheme(value);};
    apply();
    media?.addEventListener?.('change',apply);
    return()=>{media?.removeEventListener?.('change',apply);};
  },[theme]);
  const selectTheme=(value:ThemeMode)=>{
    if(options.onThemeChange)options.onThemeChange(value);
    else setLocalTheme(value);
    if(options.guest&&typeof window!=='undefined'){
      try{window.localStorage.setItem(GUEST_THEME_KEY,value);}catch{/* Private browsing/storage denied. */}
    }
  };
  const toggleTheme=()=>{
    const mediaDark=typeof window!=='undefined'&&window.matchMedia?.('(prefers-color-scheme: dark)')?.matches===true;
    selectTheme(resolvedTheme(theme,mediaDark)==='dark'?'light':'dark');
  };
  return {collapsed,mobile,theme,appearance,selectTheme,toggleCollapse:()=>setCollapsed(v=>!v),expand:()=>setCollapsed(false),openMobile:()=>setMobile(true),closeMobile:()=>setMobile(false),toggleTheme};
}
