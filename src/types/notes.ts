export interface NoteItem {
  id: string;
  title: string;
  summary: string;
  content: string;
  tags: string[];
  updatedAt: string;
  createdAt?: string;
  category?: string;
  noteType?: 'text' | 'checklist';
  readTime?: string;
  source?: string;
}
