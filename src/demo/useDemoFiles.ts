import {useState} from 'react';
import type {DocumentCategoryDto,DocumentDetail,FilesPresentation} from '../types/documents';
const id=(n:number)=>`10000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const initialCategories:DocumentCategoryDto[]=[
 {id:id(1),parent_id:null,name:'Обучение',path:['Обучение'],search_enabled:true,effective_search_enabled:true,policy_source:'model',version:1},
 {id:id(2),parent_id:null,name:'Транспорт',path:['Транспорт'],search_enabled:true,effective_search_enabled:true,policy_source:'model',version:1},
 {id:id(3),parent_id:id(2),name:'Автомобиль',path:['Транспорт','Автомобиль'],search_enabled:true,effective_search_enabled:true,policy_source:'model',version:1},
 {id:id(4),parent_id:null,name:'Скриншоты',path:['Скриншоты'],search_enabled:false,effective_search_enabled:false,policy_source:'model',version:1},
];
const make=(n:number,title:string,category:DocumentCategoryDto,summary:string,keywords:string[]):DocumentDetail=>({
 id:id(n),filename:title,title,mime_type:n===7?'image/png':'application/pdf',size_bytes:845231,status:'ready',error_code:null,
 category,searchable:category.effective_search_enabled,document_date:null,document_type:'',coverage:'complete',created_at:'2026-11-17T10:00:00Z',
 original_url:`/api/v1/documents/${id(n)}/original/`,keywords,summary,analysis_version:1,page_count:2,
 processed_at:'2026-11-17T10:01:00Z',analysis_author:'model',analysis_model:'',facts:[],values:[],
 pages:[{page:1,text:'Учебный материал по составлению смет. Примеры показывают порядок расчёта стоимости работ.'},{page:2,text:'Коэффициенты и расценки зависят от условий договора. Пример: 10 × 500 = 5000.'}],
});
/** Design-only state: no original requests, uploads or live API calls. */
export function useDemoFiles(empty:boolean):FilesPresentation {
 const [categories,setCategories]=useState(empty?[]:initialCategories);
 const [rows,setRows]=useState(empty?[]:[
  make(5,'Руководство по составлению смет.pdf',initialCategories[0],'Учебное руководство: составление смет, подбор расценок и коэффициентов. Числа в примерах служат для обучения.',['сметы','обучение','расценки','коэффициенты']),
  make(6,'Полис страхования автомобиля.pdf',initialCategories[2],'Документ о страховании автомобиля. Сохранён в папке транспорта для поиска и последующего обращения к оригиналу.',['автомобиль','страховка','полис']),
  {...make(7,'Скриншот для перевода.png',initialCategories[3],'Скриншот с текстом для перевода. Оригинал сохранён, категория исключена из поиска.',['перевод','скриншот']),page_count:1,pages:[{page:1,text:'Your reservation has been confirmed.'}]},
 ]);
 const [category,setCategory]=useState(''),[query,setQuery]=useState(''),[order,setOrder]=useState<'newest'|'name'>('newest'),[selectedId,setSelected]=useState<string|null>(null);
 const filtered=rows.filter(d=>(!category||d.category?.id===category)&&(d.title+' '+d.summary+' '+d.keywords?.join(' ')).toLowerCase().includes(query.toLowerCase()));
 if(order==='name')filtered.sort((a,b)=>a.title.localeCompare(b.title));
 const detail=rows.find(d=>d.id===selectedId)??null;
 return {designPreview:true,rows:filtered,categories,category,query,order,total:filtered.length,loading:false,loadingMore:false,error:null,hasMore:false,uploading:false,mutating:false,selectedId,detail,detailLoading:false,detailError:null,
  onRefresh:()=>{},onMore:()=>{},onCategory:value=>{setCategory(value);setSelected(null);},onSearch:setQuery,onOrder:setOrder,onSelect:setSelected,onRetryDetail:()=>{},
  onUpload:async()=>false,onReprocess:()=>{},
  onSave:async changes=>{setRows(rows.map(d=>d.id!==selectedId?d:{...d,...changes,category:categories.find(c=>c.id===changes.category_id)??null,searchable:!!categories.find(c=>c.id===changes.category_id)?.effective_search_enabled,analysis_version:d.analysis_version+1,analysis_author:'user'}));return true;},
  onCategorySearch:(c,enabled)=>{const next=categories.map(item=>item.id===c.id?{...item,search_enabled:enabled,version:item.version+1,policy_source:'user' as const}:{...item});
   const effective=(item:DocumentCategoryDto):boolean=>item.search_enabled&&(!item.parent_id||effective(next.find(p=>p.id===item.parent_id)!));
   next.forEach(item=>{item.effective_search_enabled=effective(item);});setCategories(next);setRows(rows.map(d=>({...d,category:next.find(c=>c.id===d.category?.id)??null,searchable:!!next.find(c=>c.id===d.category?.id)?.effective_search_enabled})));},
  onCreateCategory:async(name,parentId,enabled)=>{const parent=categories.find(c=>c.id===parentId);setCategories([...categories,{id:id(categories.length+30),parent_id:parentId,name,path:[...(parent?.path??[]),name],search_enabled:enabled,effective_search_enabled:enabled&&(parent?.effective_search_enabled??true),policy_source:'user',version:1}]);return true;},
 };
}
