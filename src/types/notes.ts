export interface NoteItem {
  id: string;
  title: string;
  summary: string;
  content: string;
  memoryLinks?:import('./memoryLinks').MemoryLink[];
  tags: string[];
  searchPhrases?: string[];
  updatedAt: string;
  updatedAtRaw?: string;
  createdAt?: string;
  category?: string;
  noteType?: 'text' | 'checklist';
  readTime?: string;
  source?: string;
}

/** Transport-free state shared by the existing Notes UI and its live controller. */
export interface NotesPresentation {
 scopeKey:string; loaded:boolean; loading:boolean; loadingMore:boolean; error:string|null; hasMore:boolean;
 selectedId:string|null; selectedNote:NoteItem|null; detail:NoteItem|null; detailLoading:boolean; detailError:string|null;
 onSelect:(id:string|null)=>void; onRetry:()=>void; onMore:()=>void; onRetryDetail:()=>void;
}
