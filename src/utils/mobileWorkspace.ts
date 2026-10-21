type Actions={mobileOpen:boolean;onOpenMobile:()=>void;onCloseMobile:()=>void};
type Point={x:number;y:number};
export function sidebarSwipe(start:Point,end:Point,open:boolean):'open'|'close'|null {
  const dx=end.x-start.x,dy=end.y-start.y;
  return Math.abs(dx)>=64&&Math.abs(dx)>Math.abs(dy)*2?(dx>0&&!open?'open':dx<0&&open?'close':null):null;
}
/** DOM-only presentation behavior. Never cancels native touches or browser navigation. */
export function observeMobileWorkspace(root:HTMLElement,actions:()=>Actions) {
  const media=window.matchMedia('(max-width: 1023px)');
  const viewport=window.visualViewport;
  let start:Point|null=null,opened=false;
  const selected=()=>Boolean(window.getSelection()?.toString());
  const blocked=(target:EventTarget|null,x:number)=>{
    if(!(target instanceof Element))return true;
    if(target.closest('[data-workspace-swipe="calendar"]')&&!(x>=16&&x<=36))return true;
    if(target.closest('input,textarea,select,button,a,[contenteditable], [role="slider"], [role="dialog"], [data-workspace-swipe="ignore"], canvas'))return true;
    for(let el:Element|null=target;el&&el!==root;el=el.parentElement){
      const style=window.getComputedStyle(el);
      if(/auto|scroll/.test(style.overflowX)&&el.scrollWidth>el.clientWidth+1)return true;
    }
    return false;
  };
  const reset=()=>{start=null;};
  const touchStart=(e:TouchEvent)=>{
    reset();
    if(!media.matches||e.touches.length!==1||selected())return;
    const touch=e.touches[0];
    if(blocked(e.target,touch.clientX))return;
    // Leave the outermost edge to Safari's back gesture. Content further in supports swipes too.
    if(touch.clientX<16||touch.clientX>window.innerWidth-16)return;
    start={x:touch.clientX,y:touch.clientY};opened=actions().mobileOpen;
  };
  const touchMove=(e:TouchEvent)=>{
    if(!start)return;
    if(e.touches.length!==1||Math.abs(e.touches[0].clientY-start.y)>Math.max(12,Math.abs(e.touches[0].clientX-start.x)))reset();
  };
  const touchEnd=(e:TouchEvent)=>{
    if(start&&e.changedTouches.length===1&&!selected()&&media.matches&&opened===actions().mobileOpen){
      const t=e.changedTouches[0],action=sidebarSwipe(start,{x:t.clientX,y:t.clientY},opened);
      if(action==='open'){(document.activeElement as HTMLElement|null)?.blur?.();actions().onOpenMobile();}
      else if(action==='close')actions().onCloseMobile();
    }
    reset();
  };
  const resize=()=>{
    // Follow the keyboard's visual viewport, but never compensate for deliberate pinch zoom.
    if(media.matches&&viewport&&Math.abs(viewport.scale-1)<0.01){
      root.style.setProperty('--workspace-height',`${viewport.height}px`);
      root.style.setProperty('--workspace-top',`${viewport.offsetTop}px`);
    }else {root.style.removeProperty('--workspace-height');root.style.removeProperty('--workspace-top');}
    reset();
  };
  root.addEventListener('touchstart',touchStart,{passive:true});
  root.addEventListener('touchmove',touchMove,{passive:true});
  root.addEventListener('touchend',touchEnd,{passive:true});
  root.addEventListener('touchcancel',reset,{passive:true});
  viewport?.addEventListener('resize',resize);viewport?.addEventListener('scroll',resize);
  media.addEventListener('change',resize);resize();
  return()=>{
    root.removeEventListener('touchstart',touchStart);root.removeEventListener('touchmove',touchMove);root.removeEventListener('touchend',touchEnd);root.removeEventListener('touchcancel',reset);
    viewport?.removeEventListener('resize',resize);viewport?.removeEventListener('scroll',resize);media.removeEventListener('change',resize);
    root.style.removeProperty('--workspace-height');root.style.removeProperty('--workspace-top');
  };
}
