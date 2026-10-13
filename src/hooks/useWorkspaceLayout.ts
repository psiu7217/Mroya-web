import {useEffect,useState} from 'react';
import type {ThemeMode} from '../types/mroya';
export function useWorkspaceLayout() {
 const [collapsed,setCollapsed]=useState(false),[mobile,setMobile]=useState(false),[theme,setTheme]=useState<ThemeMode>('light');
 useEffect(()=>{document.documentElement.setAttribute('data-theme',theme);return()=>document.documentElement.removeAttribute('data-theme');},[theme]);
 return {collapsed,mobile,theme,toggleCollapse:()=>setCollapsed(v=>!v),expand:()=>setCollapsed(false),openMobile:()=>setMobile(true),closeMobile:()=>setMobile(false),toggleTheme:()=>setTheme(v=>v==='light'?'dark':'light')};
}
