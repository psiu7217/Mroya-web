import React,{useEffect,useRef,useState} from 'react';
import {ArrowLeft,Check,ChevronRight,Download,FileAudio,FileText,FileVideo,Folder,Image,LoaderCircle,Menu,MoreHorizontal,PanelLeft,Pencil,RefreshCw,Search,SearchX,SlidersHorizontal,Trash2,X} from 'lucide-react';
import type {DocumentDto,DocumentDetail,DocumentCategoryDto,FilesPresentation} from '../types/documents';
import {tr} from '../i18n';
import {formatDate} from '../i18n/format';
import {isPreviewableDocumentImage} from '../utils/documentImage';

const t=(key:string,options:Record<string,unknown>={})=>tr(key,{ns:'files',...options});
const button='inline-flex items-center justify-center gap-2 rounded-xl border border-[var(--mroya-divider)] px-3 py-2 text-sm hover:bg-[var(--mroya-surface-muted)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors';
const input='w-full rounded-xl border border-[var(--mroya-divider)] bg-[var(--mroya-surface)] px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[var(--mroya-primary)]';
const fileFolder=(file:DocumentDto)=>file.category?.path.join(' / ')||t(file.source==='generated'?'generatedByMroya':'uncategorized');
const pending=(file:DocumentDto)=>file.status==='queued'||file.status==='processing';
const size=(bytes:number)=>bytes<1024?`${bytes} B`:bytes<1048576?`${(bytes/1024).toFixed(0)} KB`:`${(bytes/1048576).toFixed(1)} MB`;
const date=(value:string)=>formatDate(value,{day:'numeric',month:'short',year:'numeric'});
function trapFocus(event:React.KeyboardEvent<HTMLElement>){
 if(event.key!=='Tab')return;
 const nodes=Array.from(event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled),a[href],input:not(:disabled),textarea:not(:disabled),select:not(:disabled),summary')).filter(node=>node.getClientRects().length>0);
 const first=nodes[0],last=nodes.at(-1);
 if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}
 else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}
}
function FileIcon({file,className='h-5 w-5'}:{file:DocumentDto;className?:string}){
 const icons={image:Image,audio:FileAudio,video:FileVideo};
 const Icon=icons[file.mime_type.split('/')[0] as keyof typeof icons]??FileText;
 return <Icon aria-hidden="true" className={className}/>;
}

const menuItem='flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm hover:bg-[var(--mroya-surface-muted)] disabled:opacity-50';
function FileMenu({label,icon,children}:{label:string;icon:React.ReactNode;children:React.ReactNode}){
 const root=useRef<HTMLDetailsElement>(null);
 const trigger=useRef<HTMLElement>(null);
 useEffect(()=>{
  const outside=(event:PointerEvent)=>{if(root.current?.open&&!root.current.contains(event.target as Node))root.current.open=false;};
  document.addEventListener('pointerdown',outside);
  return ()=>document.removeEventListener('pointerdown',outside);
 },[]);
 const close=()=>{if(root.current)root.current.open=false;trigger.current?.focus({preventScroll:true});};
 return <details ref={root} className="relative shrink-0" onKeyDown={event=>{
  if(event.key!=='Escape'||!root.current?.open)return;
  event.preventDefault();event.stopPropagation();close();
 }}>
  <summary ref={trigger} title={label} aria-label={label} className={`${button} cursor-pointer list-none [&::-webkit-details-marker]:hidden`}>{icon}</summary>
  <div className="absolute right-0 z-20 mt-2 w-60 max-w-[calc(100vw-2rem)] rounded-xl border border-[var(--mroya-divider)] bg-[var(--mroya-surface)] p-1.5 shadow-[var(--mroya-shadow-elevated)]"
    onClick={event=>{if((event.target as Element).closest('button:not(:disabled)'))close();}}>
   {children}
  </div>
 </details>;
}
function Status({file}:{file:DocumentDto}){
 if(file.status==='ready')return null;
 return <span title={file.status==='needs_attention'?t('reviewHint'):undefined} className={`inline-flex items-center gap-1.5 text-xs ${file.status==='failed'?'text-red-600 dark:text-red-400':file.status==='needs_attention'?'text-amber-700 dark:text-amber-400':'text-[var(--mroya-text-muted)]'}`}>
  {pending(file)&&<LoaderCircle className="h-3 w-3 animate-spin"/>}{t('status_'+file.status)}</span>;
}
function SearchBadge({enabled}:{enabled:boolean}){return <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] ${enabled?'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400':'bg-[var(--mroya-surface-muted)] text-[var(--mroya-text-muted)]'}`}>
 {enabled?<Search className="h-3 w-3"/>:<SearchX className="h-3 w-3"/>}{t(enabled?'searchable':'storageOnly')}</span>;}

function hasImagePreview(file: DocumentDto, designPreview?: boolean) {
 return !designPreview && isPreviewableDocumentImage(file.mime_type, file.original_url, file.id);
}

function FilePreview({file, showImage, className, iconClassName, thumbnail = false}: {
 file: DocumentDto; showImage: boolean; className: string; iconClassName: string; thumbnail?: boolean;
}) {
 const [failed, setFailed] = useState(false);
 return <div className={`flex items-center justify-center overflow-hidden bg-[var(--mroya-surface-muted)] text-[var(--mroya-primary)] ${className}`}>
  {showImage && !failed
   ? <img src={file.original_url} alt={thumbnail ? '' : file.title}
       loading={thumbnail ? 'lazy' : 'eager'} decoding="async" onError={() => setFailed(true)}
       className={`h-full w-full ${thumbnail ? 'object-cover' : 'object-contain'}`}/>
   : <FileIcon file={file} className={iconClassName}/>}
 </div>;
}

function Details({runtime, file, onClose, onImageOpen}: {
 runtime: FilesPresentation; file: DocumentDto | null; onClose: () => void;
 onImageOpen?: (url: string, title: string) => void;
}) {
 const detail = runtime.detail;
 const [editing,setEditing]=useState(false),[title,setTitle]=useState(''),[summary,setSummary]=useState(''),[keywords,setKeywords]=useState(''),[category,setCategory]=useState('');
 const closeRef = useRef<HTMLButtonElement>(null);
 const busy = runtime.mutating || runtime.uploading;
 const showImage = file !== null && hasImagePreview(file, runtime.designPreview);
 useEffect(()=>{setEditing(false);if(detail){setTitle(detail.title);setSummary(detail.summary);setKeywords((detail.keywords??[]).join(', '));setCategory(detail.category?.id??'');}},[detail?.id,detail?.analysis_version]);
 useEffect(()=>{closeRef.current?.focus();},[]);
 useEffect(()=>{
  const key=(event:KeyboardEvent)=>{if(event.key==='Escape'&&!event.defaultPrevented)onClose();};
  document.addEventListener('keydown',key);
  return()=>document.removeEventListener('keydown',key);
 },[onClose]);
 const save=async(event:React.FormEvent)=>{event.preventDefault();if(await runtime.onSave({title,summary,keywords:keywords.split(',').map(v=>v.trim()).filter(Boolean),category_id:category||null}))setEditing(false);};
 const preview = file && showImage && <FilePreview file={file} showImage className="h-52 w-full rounded-xl" iconClassName="h-10 w-10"/>;
 return <aside aria-label={t('fileDetails')} onKeyDown={event=>{if(window.matchMedia('(max-width:1023px)').matches)trapFocus(event);}} className="fixed inset-0 z-40 flex flex-col bg-[var(--mroya-surface)] lg:relative lg:inset-auto lg:z-auto lg:w-[400px] xl:w-[440px] lg:shrink-0 lg:border-l lg:border-[var(--mroya-divider)]">
  <header className="flex min-h-16 shrink-0 items-center gap-2 border-b border-[var(--mroya-divider)] px-4 py-2">
   <h2 className="min-w-0 flex-1 truncate text-sm font-semibold" title={file?.title}>{file?.title ?? t('fileDetails')}</h2>
   <FileMenu label={t('fileActions')} icon={<MoreHorizontal aria-hidden="true" className="size-4"/>}>
    {detail&&!editing&&<button type="button" className={menuItem} disabled={pending(detail)||busy} onClick={()=>setEditing(true)}><Pencil className="size-4"/>{t('edit')}</button>}
    {detail&&detail.source!=='generated'&&<button type="button" className={menuItem} disabled={pending(detail)||busy}
      onClick={()=>{if(window.confirm(t('reprocessConfirm')))runtime.onReprocess();}}><RefreshCw className="size-4"/>{t('reprocess')}</button>}
    <button type="button" className={menuItem} disabled={runtime.detailLoading||busy} onClick={runtime.onRetryDetail}><RefreshCw className="size-4"/>{t('refresh')}</button>
    {file&&runtime.canDelete&&!runtime.designPreview&&<button type="button" className={`${menuItem} text-[var(--mroya-error)]`} disabled={busy}
      onClick={()=>{if(window.confirm(t('deleteConfirm',{name:file.title})))void runtime.onDelete();}}><Trash2 className="size-4"/>{t('deleteDocument')}</button>}
   </FileMenu>
   <button ref={closeRef} type="button" onClick={onClose} className={`${button} shrink-0`} aria-label={t('close')}><ArrowLeft className="size-4 lg:hidden"/><X className="hidden size-4 lg:block"/></button>
  </header>
  <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 sm:p-5">
   {file && <>
    {preview && (onImageOpen
      ? <button type="button" className="block w-full cursor-zoom-in rounded-xl" data-image-url={file.original_url}
          aria-label={t('openImage', {name: file.title})} onClick={() => onImageOpen(file.original_url, file.title)}>{preview}</button>
      : preview)}
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-[var(--mroya-text-muted)]">
     <p className="min-w-0 break-words">{fileFolder(file)}</p>
     <Status file={file}/>
    </div>
    <div className="flex flex-wrap gap-2">
     {runtime.designPreview
      ? <button disabled title={t('previewOnly')} className={button}><Download className="h-4 w-4"/>{t('downloadOriginal')}</button>
      : <a href={file.original_url} className={button} target="_blank" rel="noopener noreferrer"><Download className="h-4 w-4"/>{t('downloadOriginal')}</a>}
    </div>
   </>}
   {runtime.detailLoading&&!detail&&<p role="status" className="text-sm text-[var(--mroya-text-muted)]">{t('loading')}</p>}
   {runtime.detailError&&<div role="alert" className="rounded-xl bg-red-500/10 p-3 text-sm"><p>{runtime.detailError}</p><button className={`${button} mt-2`} onClick={runtime.onRetryDetail}>{t('refresh')}</button></div>}
   {detail&&<>
    {detail.status==='failed'&&<p className="text-sm text-red-600 dark:text-red-400">{t('processingFailed')}</p>}
    {!editing?<section>
     <h3 className="mb-2 text-sm font-medium">{t(detail.analysis_author==='user'?'yourDescription':detail.source==='generated'?'generationPrompt':'modelDescription')}</h3>
     <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-[var(--mroya-text-muted)]">{detail.summary||t(pending(detail)?'descriptionPending':'noSummary')}</p>
    </section>:<form onSubmit={save} className="space-y-3">
     <h4 className="font-medium">{t('editDetails')}</h4><label className="block text-xs">{t('name')}<input autoFocus required maxLength={240} value={title} onChange={e=>setTitle(e.target.value)} className={`${input} mt-1`}/></label>
     <label className="block text-xs">{t('folder')}<select aria-label={t('folder')} className={`${input} mt-1`} value={category} onChange={e=>setCategory(e.target.value)}><option value="">{t('uncategorized')}</option>{runtime.categories.map(c=><option key={c.id} value={c.id}>{c.path.join(' / ')}</option>)}</select></label>
     <label className="block text-xs">{t('summary')}<textarea aria-label={t('summary')} rows={6} maxLength={4000} value={summary} onChange={e=>setSummary(e.target.value)} className={`${input} mt-1 resize-y`}/></label>
     <label className="block text-xs">{t('keywords')}<textarea aria-label={t('keywords')} rows={2} value={keywords} onChange={e=>setKeywords(e.target.value)} className={`${input} mt-1`}/><span className="mt-1 block text-[var(--mroya-text-muted)]">{t('keywordsHint')}</span></label>
     <div className="flex gap-2"><button type="submit" className={button} disabled={runtime.mutating||!title.trim()}>{t(runtime.mutating?'saving':'save')}</button><button type="button" className={button} onClick={()=>setEditing(false)} disabled={runtime.mutating}>{t('cancel')}</button></div>
    </form>}
    <details className="border-t border-[var(--mroya-divider)] pt-4">
     <summary className="cursor-pointer text-sm font-medium">{t('moreDetails')}</summary>
     <div className="mt-4 space-y-4">
      <dl className="space-y-2 text-sm">
       <div className="flex flex-wrap items-baseline gap-x-2"><dt className="text-[var(--mroya-text-muted)]">{t('name')}</dt><dd className="min-w-0 break-all">{detail.filename}</dd></div>
       <div className="flex flex-wrap items-baseline gap-x-2"><dt className="text-[var(--mroya-text-muted)]">{t('size')}</dt><dd>{size(detail.size_bytes)}</dd></div>
       <div className="flex flex-wrap items-baseline gap-x-2"><dt className="text-[var(--mroya-text-muted)]">{t('uploaded')}</dt><dd>{date(detail.created_at)}</dd></div>
       {detail.document_date && <div className="flex flex-wrap items-baseline gap-x-2"><dt className="text-[var(--mroya-text-muted)]">{t('documentDate')}</dt><dd>{date(detail.document_date)}</dd></div>}
      </dl>
      <SearchBadge enabled={detail.searchable}/>
      {detail.status==='needs_attention' && <div className="text-sm text-amber-800 dark:text-amber-300">
       <p>{t('reviewHint')}</p>
       {!!detail.review_reasons?.length && <ul className="mt-2 list-disc space-y-1 pl-4">{detail.review_reasons.map(reason=><li key={reason}>{t('review_'+reason)}</li>)}</ul>}
      </div>}
      {!!detail.keywords?.length && <p className="break-words text-sm"><span className="text-[var(--mroya-text-muted)]">{t('keywords')} · </span>{detail.keywords.join(', ')}</p>}
      {!!detail.facts.length&&<section><h4 className="mb-3 font-medium">{t('selectedFacts')}</h4><ul className="space-y-3 text-sm">{detail.facts.map((fact,i)=><li key={i} className="rounded-xl bg-[var(--mroya-surface-muted)] p-3"><p className="break-words">{fact.text}</p><p className="mt-2 whitespace-pre-wrap break-words text-xs text-[var(--mroya-text-muted)]">{fact.quote}</p><span className="mt-1 block text-xs text-[var(--mroya-text-muted)]">{t('page',{number:fact.page})}</span></li>)}</ul></section>}
      {!!detail.values.length&&<section><h4 className="mb-3 font-medium">{t('selectedValues')}</h4><dl className="space-y-3 text-sm">{detail.values.map((value,i)=><div key={i} className="rounded-xl bg-[var(--mroya-surface-muted)] p-3"><dt className="break-words text-[var(--mroya-text-muted)]">{value.label}</dt><dd className="mt-1 break-words font-medium">{value.value} {value.unit}</dd>{(value.subject||value.observed_on)&&<dd className="mt-1 break-words text-xs">{[value.subject,value.observed_on].filter(Boolean).join(' · ')}</dd>}<dd className="mt-2 whitespace-pre-wrap break-words text-xs text-[var(--mroya-text-muted)]">{value.quote} · {t('page',{number:value.page})}</dd></div>)}</dl></section>}
      {!!detail.pages.length&&<details className="border-t border-[var(--mroya-divider)] pt-4"><summary className="cursor-pointer text-sm font-medium">{t('recognizedText',{count:detail.page_count})}</summary><p className="mt-2 text-xs text-[var(--mroya-text-muted)]">{t('recognizedHint')}</p>
       {detail.pages.map(page=><div key={page.page} className="mt-4"><h5 className="mb-2 text-xs font-medium">{t('page',{number:page.page})}</h5><pre className="whitespace-pre-wrap break-words rounded-xl bg-[var(--mroya-surface-muted)] p-3 font-sans text-xs leading-relaxed">{page.text||t('emptyPage')}</pre></div>)}
      </details>}
     </div>
    </details>
   </>}
  </div>
 </aside>;
}

export function FilesView({runtime,isSidebarCollapsed,onExpandSidebar,onOpenMobileMenu,onImageOpen}:{
 runtime?:FilesPresentation;isSidebarCollapsed?:boolean;onExpandSidebar?:()=>void;onOpenMobileMenu?:()=>void;
 onImageOpen?:(url:string,title:string)=>void;
}){
 const [query,setQuery]=useState('');
 const selectedTile=useRef<HTMLButtonElement>(null);
 useEffect(()=>{setQuery(runtime?.query??'');},[runtime?.query]);
 const category=runtime?.categories.find(c=>c.id===runtime.category);
 const folders=runtime?.categories.filter(c=>c.parent_id===(category?.id??null)).sort((a,b)=>a.name.localeCompare(b.name))??[];
 const breadcrumbs:DocumentCategoryDto[]=[];let node=category;const seen=new Set<string>();
 while(node&&!seen.has(node.id)){seen.add(node.id);breadcrumbs.unshift(node);node=runtime?.categories.find(c=>c.id===node!.parent_id);}
 const close=()=>{runtime?.onSelect(null);selectedTile.current?.focus({preventScroll:true});};
 const file=runtime?.detail??runtime?.rows.find(row=>row.id===runtime.selectedId)??null;
 const busy=!!(runtime?.mutating||runtime?.uploading);
 return <div className="flex h-full min-h-0 min-w-0 flex-1 bg-[var(--mroya-surface)] text-[var(--mroya-text)]">
  <div className="flex min-h-0 min-w-0 flex-1 flex-col">
   <header className="flex min-h-20 shrink-0 flex-wrap items-center justify-between gap-3 border-b border-[var(--mroya-divider)] px-4 py-4 sm:px-6">
    <div className="flex items-center gap-3"><button className={`${button} lg:hidden`} onClick={onOpenMobileMenu} aria-label={t('openMenu')}><Menu className="h-4 w-4"/></button>{isSidebarCollapsed&&<button className={`${button} hidden lg:inline-flex`} onClick={onExpandSidebar} aria-label={t('expandSidebar')}><PanelLeft className="h-4 w-4"/></button>}<h1 className="text-xl font-semibold">{t('title')}</h1></div>
   </header>
   {!runtime?<div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center"><Folder className="h-12 w-12 text-[var(--mroya-text-muted)]"/><p className="text-sm text-[var(--mroya-text-muted)]">{t('unavailable')}</p></div>:<>
    <div className="space-y-3 border-b border-[var(--mroya-divider)] px-4 py-3 sm:px-6">
     <div className="flex items-center gap-2">
      <form className="flex min-w-0 flex-1 items-center gap-2" onSubmit={event=>{event.preventDefault();runtime.onSearch(query);}}>
       <div className="relative min-w-0 flex-1">
        <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-2.5 size-4 text-[var(--mroya-text-muted)]"/>
        <input type="search" maxLength={200} value={query} onChange={event=>setQuery(event.target.value)}
          placeholder={t('searchPlaceholder')} aria-label={t('searchPlaceholder')} className={`${input} pl-9`}/>
       </div>
       <button type="submit" className={button}>{t('find')}</button>
      </form>
      <FileMenu label={t('filtersAndSort')} icon={<SlidersHorizontal aria-hidden="true" className={`size-4 ${runtime.category||runtime.order!=='newest'?'text-[var(--mroya-primary)]':''}`}/>}>
       {([['','allFiles'],['uncategorized','uncategorized'],['generated','generatedByMroya']] as const).map(([id,label])=>(
        <button key={id} type="button" className={menuItem} aria-pressed={runtime.category===id} onClick={()=>runtime.onCategory(id)}>
         <span className="grid size-4 place-items-center" aria-hidden="true">{runtime.category===id&&<Check className="size-4"/>}</span>{t(label)}
        </button>
       ))}
       <div className="my-1 border-t border-[var(--mroya-divider)]"/>
       {([['newest','newest'],['name','byName']] as const).map(([order,label])=>(
        <button key={order} type="button" className={menuItem} aria-pressed={runtime.order===order} onClick={()=>runtime.onOrder(order)}>
         <span className="grid size-4 place-items-center" aria-hidden="true">{runtime.order===order&&<Check className="size-4"/>}</span>{t(label)}
        </button>
       ))}
       {category&&<div className="my-1 border-t border-[var(--mroya-divider)]">
        <button type="button" className={menuItem} disabled={busy||runtime.loading} aria-pressed={category.search_enabled}
          onClick={()=>runtime.onCategorySearch(category,!category.search_enabled)}>
         <span className="grid size-4 shrink-0 place-items-center" aria-hidden="true">{category.search_enabled&&<Check className="size-4"/>}</span>{t('enableSearch')}
        </button>
        {category.search_enabled&&!category.effective_search_enabled&&<p className="px-2.5 pb-1.5 text-xs text-[var(--mroya-text-muted)]">{t('parentExcluded')}</p>}
       </div>}
       <button type="button" className={menuItem} disabled={runtime.loading||busy} onClick={runtime.onRefresh}><RefreshCw className="size-4"/>{t('refresh')}</button>
      </FileMenu>
     </div>
     {!!runtime.category&&<nav aria-label={t('folderPath')} className="flex min-w-0 flex-wrap items-center gap-1 text-sm">
      <button type="button" onClick={()=>runtime.onCategory('')} className="rounded-lg px-2 py-1 hover:bg-[var(--mroya-surface-muted)]">{t('allFiles')}</button>
      {breadcrumbs.map((folder,index)=><React.Fragment key={folder.id}>
       <ChevronRight aria-hidden="true" className="size-3.5 text-[var(--mroya-text-muted)]"/>
       {index===breadcrumbs.length-1
        ? <span aria-current="page" className="max-w-48 truncate px-2 py-1">{folder.name}</span>
        : <button type="button" onClick={()=>runtime.onCategory(folder.id)} className="max-w-48 truncate rounded-lg px-2 py-1 hover:bg-[var(--mroya-surface-muted)]">{folder.name}</button>}
      </React.Fragment>)}
      {['uncategorized','generated'].includes(runtime.category)&&<>
       <ChevronRight aria-hidden="true" className="size-3.5 text-[var(--mroya-text-muted)]"/>
       <span aria-current="page">{t(runtime.category==='generated'?'generatedByMroya':'uncategorized')}</span>
      </>}
     </nav>}
    </div>
    <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6" aria-busy={runtime.loading}>
     {runtime.error&&<div role="alert" className="mb-4 rounded-xl bg-red-500/10 p-3 text-sm"><p>{runtime.error}</p><button className={`${button} mt-2`} onClick={runtime.onRefresh}>{t('refresh')}</button></div>}
     {!runtime.query&&!['uncategorized','generated'].includes(runtime.category)&&folders.length>0&&<section className="mb-7"><h2 className="mb-3 text-xs font-medium uppercase tracking-wide text-[var(--mroya-text-muted)]">{t('folders')}</h2><div className="grid grid-cols-2 gap-3 xl:grid-cols-3">{folders.map(folder=><button key={folder.id} onClick={()=>runtime.onCategory(folder.id)} className="flex min-w-0 items-center gap-3 rounded-xl border border-[var(--mroya-divider)] px-3 py-4 text-left hover:bg-[var(--mroya-surface-muted)]"><Folder className="h-7 w-7 shrink-0 fill-blue-500/10 text-blue-500"/><div className="min-w-0"><p className="truncate text-sm font-medium">{folder.name}</p></div></button>)}</div></section>}
     <div className="mb-3 flex items-center justify-between gap-2"><h2 className="text-xs font-medium uppercase tracking-wide text-[var(--mroya-text-muted)]">{t('filesCount',{count:runtime.total})}</h2>{runtime.category&&<button className="flex items-center gap-1 text-xs text-[var(--mroya-text-muted)]" onClick={()=>runtime.onCategory(category?.parent_id??'')}><ArrowLeft className="h-3 w-3"/>{t('back')}</button>}</div>
     {!runtime.loading&&runtime.rows.length===0&&!runtime.error&&<div className="rounded-2xl border border-dashed border-[var(--mroya-divider)] py-14 px-5 text-center"><Folder className="mx-auto mb-4 h-11 w-11 text-[var(--mroya-text-muted)]"/><h3 className="font-medium">{t(runtime.query?'noResults':'emptyTitle')}</h3><p className="mx-auto mt-2 max-w-sm text-sm text-[var(--mroya-text-muted)]">{t(runtime.query?'noResultsHint':runtime.category==='generated'?'generatedEmptyHint':'emptyHint')}</p></div>}
     {runtime.loading&&runtime.rows.length===0&&<p role="status" className="py-10 text-center text-sm text-[var(--mroya-text-muted)]">{t('loading')}</p>}
     {!!runtime.rows.length && <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,9rem),1fr))] gap-3">
      {runtime.rows.map(file => (
       <button type="button" key={file.id} onClick={event=>{selectedTile.current=event.currentTarget;runtime.onSelect(file.id);}} aria-pressed={runtime.selectedId===file.id}
        className={`min-w-0 self-start rounded-xl border p-2 text-left hover:bg-[var(--mroya-surface-muted)] sm:p-3 ${runtime.selectedId===file.id?'border-[var(--mroya-primary)]':'border-[var(--mroya-divider)]'}`}>
        <FilePreview file={file} showImage={hasImagePreview(file,runtime.designPreview)} thumbnail
         className="mb-2 aspect-[4/3] w-full rounded-lg" iconClassName="size-9"/>
        <span className="block truncate text-sm font-medium" title={file.title}>{file.title}</span>
        <Status file={file}/>
       </button>
      ))}
     </div>}
     {runtime.hasMore&&<div className="mt-5 text-center"><button className={button} disabled={runtime.loadingMore||runtime.loading} onClick={runtime.onMore}>{t(runtime.loadingMore?'loading':'loadMore')}</button></div>}
    </div>
   </>}
  </div>
  {runtime?.selectedId&&<Details key={runtime.selectedId} runtime={runtime} file={file} onClose={close} onImageOpen={onImageOpen}/>}
 </div>;
}
