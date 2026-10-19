import React, { useState } from 'react';
import {
  Search,
  Plus,
  Edit3,
  Trash2,
  Share2,
  FileText,
  Check,
  X,
  Menu,
  MessageSquare,
  Sparkles,
  Brain,
  Calendar as CalendarIcon,
  Mail,
  Send,
  AlertCircle,
  AlertTriangle,
  Clock,
  CheckCircle2,
  Inbox,
  RefreshCw,
  RotateCcw,
  Users,
  User,
  ArrowRight,
} from 'lucide-react';
import { MemoryItem, MemoryCategory } from '../types/mroya';

export interface MemoryViewProps {
  readOnly?: boolean;
  memories: MemoryItem[];
  selectedMemoryId: string | null;
  onSelectMemory: (id: string) => void;
  onUpdateMemory: (updated: MemoryItem) => void;
  onForgetMemory: (id: string) => void;
  onAddMemory: (item: Omit<MemoryItem, 'id'>) => void;
  onExploreInMap: (nodeId: string) => void;
  onAskMroyaAbout: (memory: MemoryItem) => void;
  isSidebarCollapsed: boolean;
  onExpandSidebar: () => void;
  onOpenMobileMenu: () => void;
}

const CATEGORIES: ('All' | MemoryCategory)[] = [
  'All',
  'Agreements & Decisions',
  'People & Clients',
  'Dates & Commitments',
  'Preferences',
];

export type ProposalSourceType = 'Calendar' | 'Email' | 'Drive';

export type ProposalStatus =
  | 'new'
  | 'reanalyzing'
  | 'accepted'
  | 'declined'
  | 'applied'
  | 'outdated'
  | 'error';

export interface MemoryMatch {
  id: string;
  name: string;
  relation?: string;
  similarity?: string;
}

export interface InboxProposal {
  id: string;
  title: string;
  source: ProposalSourceType;
  sourceResourceTitle: string;
  sourceDate: string;
  actionProposed: string;
  explanation: string;
  memoryMatches: MemoryMatch[];
  status: ProposalStatus;
  comment?: string;
  draftComment?: string;
  isCommentOpen?: boolean;
  errorMessage?: string;
  suggestedComment?: string;
  isConfirmed?: boolean;
}

const INITIAL_PROPOSALS: InboxProposal[] = [
  {
    id: 'prop-1',
    title: 'Марк день рождения — 14 января',
    source: 'Calendar',
    sourceResourceTitle: 'Событие «ДР Марка»',
    sourceDate: '14 января (повторяется ежегодно)',
    actionProposed: 'Создать контакт «Марк» и сохранить дату рождения: 14 января',
    explanation: 'В календаре обнаружено ежегодное событие. В существующей памяти контакт «Марк» отсутствует. Модель предлагает создать новую сущность и зафиксировать факт даты рождения.',
    memoryMatches: [],
    status: 'new',
    suggestedComment: 'Марк — мой сын',
    isConfirmed: false,
  },
  {
    id: 'prop-2',
    title: 'Вадя день омона',
    source: 'Calendar',
    sourceResourceTitle: 'Событие «Вадя день омона»',
    sourceDate: '22 ноября, 19:00',
    actionProposed: 'Уточнить человека «Вадя» и контекст события',
    explanation: 'Модель обнаружила упоминание возможного человека по имени «Вадя» в неформальном контексте. В памяти нет людей с таким именем. Требуется уточнить, кто он и какое отношение имеет к вам.',
    memoryMatches: [],
    status: 'new',
    suggestedComment: 'Вадя — коллега по проекту из Минска',
    isConfirmed: false,
  },
  {
    id: 'prop-3',
    title: 'Годовщина Мурашки',
    source: 'Calendar',
    sourceResourceTitle: 'Событие «Годовщина Мурашки»',
    sourceDate: '18 сентября',
    actionProposed: 'Установить участников события и связать с семьей Мурашко',
    explanation: 'В названии события фигурирует фамилия Мурашко. В памяти обнаружены связанные контакты: Дмитрий Мурашко и Татьяна Мурашко. Модель предлагает связать событие с обоими участниками.',
    memoryMatches: [
      { id: 'match-dm', name: 'Дмитрий Мурашко', relation: 'Друг / Коллега', similarity: '88% совпадение' },
      { id: 'match-tm', name: 'Татьяна Мурашко', relation: 'Супруга Дмитрия', similarity: '85% совпадение' },
    ],
    status: 'new',
    suggestedComment: 'Дмитрий Мурашко и Татьяна Мурашко — мои друзья',
    isConfirmed: false,
  },
  {
    id: 'prop-4',
    title: 'ДР Сашки',
    source: 'Calendar',
    sourceResourceTitle: 'Событие «ДР Сашки»',
    sourceDate: '5 мая',
    actionProposed: 'Связать событие с существующим контактом «Александр»',
    explanation: 'Модель нашла существующего Александра в памяти и предлагает связать событие дня рождения с его карточкой.',
    memoryMatches: [
      { id: 'match-alex', name: 'Александр Белов (Сашка)', relation: 'Друг детства, архитектор', similarity: '94% совпадение' },
    ],
    status: 'new',
    suggestedComment: 'Да, это Александр Белов',
    isConfirmed: false,
  },
  {
    id: 'prop-5',
    title: 'Re: Обсуждение договора поставки',
    source: 'Email',
    sourceResourceTitle: 'Письмо «Договор поставки ООО Вектор.pdf»',
    sourceDate: 'Вчера, 16:42',
    actionProposed: 'Зафиксировать условие отсрочки платежа на 14 дней',
    explanation: 'В цепочке писем обнаружено согласование финансового условия. Выполняется повторный анализ контекста письма с учетом вашего комментария.',
    memoryMatches: [
      { id: 'match-vektor', name: 'ООО Вектор', relation: 'Поставщик оборудования', similarity: '98% совпадение' },
    ],
    status: 'reanalyzing',
    comment: 'Кирилл — представитель поставщика ООО Вектор',
    isConfirmed: false,
  },
  {
    id: 'prop-6',
    title: 'Семейный отпуск — 1-15 августа',
    source: 'Calendar',
    sourceResourceTitle: 'Событие «Отпуск с семьей»',
    sourceDate: '1 августа 2026',
    actionProposed: 'Сохранить период отпуска в категорию «Dates & Commitments»',
    explanation: 'Период отпуска подтвержден и успешно интегрирован в долговременную память.',
    memoryMatches: [
      { id: 'match-family', name: 'Семья', relation: 'Близкий круг', similarity: '100% совпадение' },
    ],
    status: 'applied',
    isConfirmed: true,
  },
  {
    id: 'prop-7',
    title: 'Звонок по стажировке',
    source: 'Calendar',
    sourceResourceTitle: 'Событие «Интервью со стажером» (удалено)',
    sourceDate: '10 октября 2026',
    actionProposed: 'Создать заметку о кандидате',
    explanation: 'Исходное календарное событие было отменено или удалено из Google Calendar. Предложение помечено как устаревшее.',
    memoryMatches: [],
    status: 'outdated',
    isConfirmed: false,
  },
  {
    id: 'prop-8',
    title: 'Проектная спецификация Alpha',
    source: 'Drive',
    sourceResourceTitle: 'Документ «Alpha_Spec_v2.gdoc»',
    sourceDate: '3 дня назад',
    actionProposed: 'Извлечь ключевые архитектурные ограничения проекта',
    explanation: 'Сбой при обращении к сервису семантического анализа документов. Нажмите «Повторить» для повторного запроса.',
    memoryMatches: [],
    status: 'error',
    errorMessage: 'Сервис анализа документов временно недоступен (503 Service Unavailable)',
    isConfirmed: false,
  },
];

export const MemoryView: React.FC<MemoryViewProps> = ({
  readOnly=false,
  memories,
  selectedMemoryId,
  onSelectMemory,
  onUpdateMemory,
  onForgetMemory,
  onAddMemory,
  onExploreInMap,
  onAskMroyaAbout,
  isSidebarCollapsed,
  onExpandSidebar,
  onOpenMobileMenu,
}) => {
  // Main Navigation: 'memories' | 'inbox'
  const [activeMainTab, setActiveMainTab] = useState<'memories' | 'inbox'>('memories');

  // Memories tab state
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<'All' | MemoryCategory>('All');
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editSummary, setEditSummary] = useState('');
  const [editDetails, setEditDetails] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // New memory modal inputs
  const [newTitle, setNewTitle] = useState('');
  const [newCategory, setNewCategory] = useState<MemoryCategory>('Agreements & Decisions');
  const [newSummary, setNewSummary] = useState('');
  const [newEntities, setNewEntities] = useState('');

  // Inbox tab state
  const [proposals, setProposals] = useState<InboxProposal[]>(INITIAL_PROPOSALS);
  const [inboxFilter, setInboxFilter] = useState<
    'all' | 'new' | 'reanalyzing' | 'accepted' | 'declined' | 'applied' | 'outdated' | 'error' | 'empty' | 'loading'
  >('all');

  const pendingProposalsCount = proposals.filter((p) => p.status === 'new').length;

  const filteredMemories = memories.filter((m) => {
    const matchesCat = activeCategory === 'All' || m.category === activeCategory;
    if (!matchesCat) return false;
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      m.title.toLowerCase().includes(q) ||
      m.summary.toLowerCase().includes(q) ||
      m.details.toLowerCase().includes(q) ||
      m.entities.some((ent) => ent.toLowerCase().includes(q))
    );
  });

  const activeMemory =
    memories.find((m) => m.id === selectedMemoryId) || filteredMemories[0] || null;

  const startEditing = (mem: MemoryItem) => {
    if(readOnly)return;
    setEditTitle(mem.title);
    setEditSummary(mem.summary);
    setEditDetails(mem.details);
    setIsEditing(true);
  };

  const handleSaveEdit = () => {
    if (!activeMemory) return;
    onUpdateMemory({
      ...activeMemory,
      title: editTitle.trim() || activeMemory.title,
      summary: editSummary.trim() || activeMemory.summary,
      details: editDetails.trim() || activeMemory.details,
    });
    setIsEditing(false);
  };

  const handleCreateMemory = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newSummary.trim()) return;
    onAddMemory({
      title: newTitle.trim(),
      summary: newSummary.trim(),
      details: newSummary.trim(),
      category: newCategory,
      dateSaved: 'Oct 12, 2026',
      source: 'Manual entry · Oct 12',
      entities: newEntities
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
      relatedNodeId: 'node-redesign',
    });
    setNewTitle('');
    setNewSummary('');
    setIsAddModalOpen(false);
  };

  // Inbox Proposal Handlers
  const handleAcceptProposal = (id: string) => {
    setProposals((prev) =>
      prev.map((p) => (p.id === id ? { ...p, status: 'accepted' } : p))
    );
  };

  const handleApplyProposal = (id: string) => {
    setProposals((prev) =>
      prev.map((p) => (p.id === id ? { ...p, status: 'applied', isConfirmed: true } : p))
    );
  };

  const handleDeclineProposal = (id: string) => {
    setProposals((prev) =>
      prev.map((p) => (p.id === id ? { ...p, status: 'declined' } : p))
    );
  };

  const handleToggleComment = (id: string) => {
    setProposals((prev) =>
      prev.map((p) =>
        p.id === id
          ? {
              ...p,
              isCommentOpen: !p.isCommentOpen,
              draftComment: p.draftComment ?? p.suggestedComment ?? '',
            }
          : p
      )
    );
  };

  const handleDraftCommentChange = (id: string, text: string) => {
    setProposals((prev) =>
      prev.map((p) => (p.id === id ? { ...p, draftComment: text } : p))
    );
  };

  const handleSendComment = (id: string) => {
    setProposals((prev) =>
      prev.map((p) => {
        if (p.id !== id) return p;
        const text = p.draftComment?.trim() || p.suggestedComment || 'Уточнение от пользователя';
        return {
          ...p,
          status: 'reanalyzing',
          comment: text,
          isCommentOpen: false,
        };
      })
    );
  };

  const handleRetryProposal = (id: string) => {
    setProposals((prev) =>
      prev.map((p) => (p.id === id ? { ...p, status: 'reanalyzing', errorMessage: undefined } : p))
    );
  };

  const handleResetProposals = () => {
    setProposals(INITIAL_PROPOSALS);
    setInboxFilter('all');
  };

  // Filter proposals according to simulator/filter selector
  const visibleProposals = proposals.filter((p) => {
    if (inboxFilter === 'all') return true;
    if (inboxFilter === 'new') return p.status === 'new';
    if (inboxFilter === 'reanalyzing') return p.status === 'reanalyzing';
    if (inboxFilter === 'accepted') return p.status === 'accepted';
    if (inboxFilter === 'declined') return p.status === 'declined';
    if (inboxFilter === 'applied') return p.status === 'applied';
    if (inboxFilter === 'outdated') return p.status === 'outdated';
    if (inboxFilter === 'error') return p.status === 'error';
    return true;
  });

  return (
    <div className="flex-1 flex flex-col h-full min-w-0 bg-[var(--mroya-bg)] text-[var(--mroya-text)]">
      {/* Header with Navigation between Saved Memories and Proposals */}
      <header className="h-[58px] px-4 sm:px-6 border-b border-[var(--mroya-divider)] flex items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <button
            type="button"
            onClick={onOpenMobileMenu}
            aria-label="Open navigation"
            className="lg:hidden inline-flex items-center justify-center w-9 h-9 rounded-lg text-[var(--mroya-text-muted)] hover:text-[var(--mroya-text)] hover:bg-[var(--mroya-surface-muted)]"
          >
            <Menu className="w-5 h-5" />
          </button>

          {/* Tab Selector: Memories vs Proposals (Inbox) */}
          <div className="flex items-center gap-1 bg-[var(--mroya-surface)] p-1 rounded-[10px] border border-[var(--mroya-divider)]">
            <button
              type="button"
              onClick={() => setActiveMainTab('memories')}
              className={`px-3 py-1.5 rounded-[8px] text-[13px] font-semibold transition-colors cursor-pointer flex items-center gap-1.5 ${
                activeMainTab === 'memories'
                  ? 'bg-[var(--mroya-surface-active)] text-[var(--mroya-text)] shadow-xs'
                  : 'text-[var(--mroya-text-muted)] hover:text-[var(--mroya-text)]'
              }`}
            >
              <span>Сохранённая память</span>
              <span className="text-[11px] font-medium opacity-75">({memories.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveMainTab('inbox')}
              className={`px-3 py-1.5 rounded-[8px] text-[13px] font-semibold transition-colors cursor-pointer flex items-center gap-1.5 ${
                activeMainTab === 'inbox'
                  ? 'bg-[var(--mroya-surface-active)] text-[var(--mroya-text)] shadow-xs'
                  : 'text-[var(--mroya-text-muted)] hover:text-[var(--mroya-text)]'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-[var(--mroya-brand-honey)]" />
              <span>Предложения</span>
              {pendingProposalsCount > 0 && (
                <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-[var(--mroya-primary)] text-[var(--mroya-on-primary)] text-[11px] font-bold flex items-center justify-center">
                  {pendingProposalsCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {activeMainTab === 'memories' ? (
          <button
            type="button"
            disabled={readOnly}
            onClick={() => setIsAddModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[var(--mroya-primary)] hover:bg-[var(--mroya-primary-hover)] text-[var(--mroya-on-primary)] text-[13px] font-semibold transition-colors cursor-pointer whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            <span>Add memory</span>
          </button>
        ) : (
          <div className="text-[12px] text-[var(--mroya-text-muted)] hidden sm:flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-[var(--mroya-brand-honey)]" />
            <span>AI Memory Intelligence</span>
          </div>
        )}
      </header>

      {/* VIEW 1: SAVED MEMORIES */}
      {activeMainTab === 'memories' && (
        <>
          {/* Search & Category Filter Bar */}
          <div className="px-4 sm:px-6 py-3.5 border-b border-[var(--mroya-divider)] bg-[var(--mroya-bg)] flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="relative w-full md:w-80">
              <Search className="w-4 h-4 text-[var(--mroya-text-muted)] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search people, agreements, PO numbers..."
                aria-label="Search memories"
                className="w-full pl-9 pr-8 py-1.5 rounded-[8px] bg-[var(--mroya-surface)] border border-[var(--mroya-input-outline)] text-[13px] text-[var(--mroya-text)] placeholder:text-[var(--mroya-text-muted)]"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  aria-label="Clear search"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--mroya-text-muted)] hover:text-[var(--mroya-text)]"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Interactive Category Filter Buttons */}
            <div className="flex items-center gap-1 overflow-x-auto pb-1 md:pb-0">
              {CATEGORIES.map((cat) => {
                const active = activeCategory === cat;
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setActiveCategory(cat)}
                    className={`px-3 py-1.5 rounded-[8px] text-[12px] font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      active
                        ? 'bg-[var(--mroya-surface-active)] text-[var(--mroya-text)] font-semibold'
                        : 'text-[var(--mroya-text-muted)] hover:text-[var(--mroya-text)] hover:bg-[var(--mroya-surface-muted)]'
                    }`}
                  >
                    {cat}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Main Master-Detail Memory Content */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6">
            <div className="max-w-[1120px] mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Left 5 cols: Memory List */}
              <div className="lg:col-span-5 space-y-2.5">
                {filteredMemories.map((mem) => {
                  const isSelected = activeMemory?.id === mem.id;
                  return (
                    <button
                      key={mem.id}
                      type="button"
                      onClick={() => {
                        onSelectMemory(mem.id);
                        setIsEditing(false);
                      }}
                      className={`w-full text-left p-4 rounded-[12px] border transition-colors cursor-pointer ${
                        isSelected
                          ? 'bg-[var(--mroya-surface-active)] border-[var(--mroya-primary)]'
                          : 'bg-[var(--mroya-surface)] border-[var(--mroya-divider)] hover:bg-[var(--mroya-surface-muted)]'
                      }`}
                    >
                      <div className="text-[12px] text-[var(--mroya-text-muted)] flex items-center gap-1.5 mb-1 tabular-nums">
                        <span>{mem.category}</span>
                        <span aria-hidden="true">·</span>
                        <span>{mem.dateSaved}</span>
                      </div>
                      <div className="text-[15px] font-semibold text-[var(--mroya-text)] mb-1">
                        {mem.title}
                      </div>
                      <p className="text-[13px] text-[var(--mroya-text-muted)] line-clamp-2 leading-[19px]">
                        {mem.summary}
                      </p>
                    </button>
                  );
                })}

                {filteredMemories.length === 0 && (
                  <div className="p-8 rounded-[12px] bg-[var(--mroya-surface)] border border-[var(--mroya-divider)] text-center space-y-2">
                    <p className="text-[14px] font-semibold text-[var(--mroya-text)]">
                      No matching memories found
                    </p>
                    <p className="text-[13px] text-[var(--mroya-text-muted)]">
                      Try clearing your search filter or add a new remembered fact.
                    </p>
                  </div>
                )}
              </div>

              {/* Right 7 cols: Memory Detail Inspector */}
              <div className="lg:col-span-7">
                {activeMemory ? (
                  <div className="p-5 sm:p-6 rounded-[12px] bg-[var(--mroya-surface)] border border-[var(--mroya-divider)] shadow-[var(--mroya-shadow-subtle)] space-y-5">
                    <div className="flex flex-wrap items-center justify-between gap-2 pb-4 border-b border-[var(--mroya-divider)]">
                      <div className="text-[12px] text-[var(--mroya-text-muted)] flex items-center gap-1.5 tabular-nums">
                        <span>{activeMemory.category}</span>
                        <span aria-hidden="true">·</span>
                        <span>Saved {activeMemory.dateSaved}</span>
                      </div>

                      <div className="flex items-center gap-2">
                        {!isEditing ? (
                          <>
                            <button
                              type="button"
                              disabled={readOnly}
                              onClick={() => startEditing(activeMemory)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] bg-[var(--mroya-surface-muted)] hover:bg-[var(--mroya-surface-active)] text-[12px] font-semibold text-[var(--mroya-text)] transition-colors cursor-pointer"
                            >
                              <Edit3 className="w-3.5 h-3.5 text-[var(--mroya-primary)]" />
                              <span>Edit</span>
                            </button>
                            <button
                              type="button"
                              disabled={readOnly}
                              onClick={() => onForgetMemory(activeMemory.id)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] bg-[var(--mroya-surface-muted)] hover:bg-[var(--mroya-error)]/15 text-[12px] font-semibold text-[var(--mroya-error)] transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>Forget</span>
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() => setIsEditing(false)}
                              className="px-3 py-1.5 rounded-[8px] bg-[var(--mroya-surface-muted)] text-[12px] font-medium text-[var(--mroya-text)] cursor-pointer"
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              onClick={handleSaveEdit}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] bg-[var(--mroya-primary)] text-[var(--mroya-on-primary)] text-[12px] font-semibold cursor-pointer"
                            >
                              <Check className="w-3.5 h-3.5" />
                              <span>Save changes</span>
                            </button>
                          </>
                        )}
                      </div>
                    </div>

                    {!isEditing ? (
                      <>
                        <div className="space-y-3">
                          <h2 className="text-[20px] font-semibold text-[var(--mroya-text)] leading-[28px]">
                            {activeMemory.title}
                          </h2>
                          <div className="p-3.5 rounded-[10px] bg-[var(--mroya-surface-muted)] text-[14px] font-medium text-[var(--mroya-text)] leading-[21px]">
                            {activeMemory.summary}
                          </div>
                          <p className="text-[14px] text-[var(--mroya-text)] leading-[23px]">
                            {activeMemory.details}
                          </p>
                        </div>

                        <div className="pt-4 border-t border-[var(--mroya-divider)] grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <div className="text-[12px] font-medium text-[var(--mroya-text-muted)] mb-1">
                              Source & provenance
                            </div>
                            <div className="flex items-center gap-2 text-[13px] font-medium text-[var(--mroya-text)]">
                              <FileText className="w-4 h-4 text-[var(--mroya-primary)] shrink-0" />
                              <span>{activeMemory.source}</span>
                            </div>
                          </div>

                          <div>
                            <div className="text-[12px] font-medium text-[var(--mroya-text-muted)] mb-1">
                              Connected entities
                            </div>
                            <div className="text-[13px] font-medium text-[var(--mroya-text)]">
                              {activeMemory.entities.join(' · ')}
                            </div>
                          </div>
                        </div>

                        <div className="pt-4 border-t border-[var(--mroya-divider)] flex flex-wrap items-center gap-2.5">
                          <button
                            type="button"
                            onClick={() => onExploreInMap(activeMemory.relatedNodeId)}
                            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-[8px] bg-[var(--mroya-surface-muted)] hover:bg-[var(--mroya-surface-active)] text-[13px] font-semibold text-[var(--mroya-text)] transition-colors cursor-pointer"
                          >
                            <Share2 className="w-4 h-4 text-[var(--mroya-primary)]" />
                            <span>Explore in Memory Map</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => onAskMroyaAbout(activeMemory)}
                            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-[8px] bg-[var(--mroya-surface-muted)] hover:bg-[var(--mroya-surface-active)] text-[13px] font-semibold text-[var(--mroya-primary)] transition-colors cursor-pointer"
                          >
                            <MessageSquare className="w-4 h-4" />
                            <span>Ask Mroya about this memory</span>
                          </button>
                        </div>
                      </>
                    ) : (
                      <div className="space-y-4">
                        <div>
                          <label className="block text-[12px] font-semibold text-[var(--mroya-text)] mb-1">
                            Memory title
                          </label>
                          <input
                            type="text"
                            value={editTitle}
                            onChange={(e) => setEditTitle(e.target.value)}
                            className="w-full px-3 py-2 rounded-[8px] bg-[var(--mroya-surface)] border border-[var(--mroya-input-outline)] text-[14px] text-[var(--mroya-text)]"
                          />
                        </div>
                        <div>
                          <label className="block text-[12px] font-semibold text-[var(--mroya-text)] mb-1">
                            Key summary
                          </label>
                          <textarea
                            rows={2}
                            value={editSummary}
                            onChange={(e) => setEditSummary(e.target.value)}
                            className="w-full px-3 py-2 rounded-[8px] bg-[var(--mroya-surface)] border border-[var(--mroya-input-outline)] text-[14px] text-[var(--mroya-text)]"
                          />
                        </div>
                        <div>
                          <label className="block text-[12px] font-semibold text-[var(--mroya-text)] mb-1">
                            Full context & notes
                          </label>
                          <textarea
                            rows={4}
                            value={editDetails}
                            onChange={(e) => setEditDetails(e.target.value)}
                            className="w-full px-3 py-2 rounded-[8px] bg-[var(--mroya-surface)] border border-[var(--mroya-input-outline)] text-[14px] text-[var(--mroya-text)]"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </>
      )}

      {/* VIEW 2: MEMORY INBOX (ПРЕДЛОЖЕНИЯ) */}
      {activeMainTab === 'inbox' && (
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          <div className="max-w-[1020px] mx-auto space-y-6">
            {/* Header intro card */}
            <div className="p-5 sm:p-6 rounded-[12px] bg-[var(--mroya-surface)] border border-[var(--mroya-divider)] space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-[var(--mroya-surface-active)] border border-[var(--mroya-divider)] flex items-center justify-center text-[var(--mroya-primary)] shrink-0">
                    <Inbox className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-[18px] font-semibold text-[var(--mroya-text)]">
                      Memory Inbox — Предложения AI
                    </h2>
                    <p className="text-[13px] text-[var(--mroya-text-muted)] mt-0.5">
                      Кандидаты в персональную память, обнаруженные моделью в календаре и внешних сервисах
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-start sm:self-center">
                  <button
                    type="button"
                    onClick={handleResetProposals}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] text-[12px] font-medium bg-[var(--mroya-surface-muted)] hover:bg-[var(--mroya-surface-active)] text-[var(--mroya-text)] border border-[var(--mroya-divider)] transition-colors cursor-pointer"
                    title="Сбросить все карточки к исходному состоянию"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Сброс демо</span>
                  </button>
                </div>
              </div>

              {/* State Preview Switcher Toolbar */}
              <div className="pt-3 border-t border-[var(--mroya-divider)]/60">
                <div className="text-[11px] uppercase tracking-wider text-[var(--mroya-text-muted)] font-semibold mb-2 flex items-center gap-1.5">
                  <Sparkles className="w-3 h-3 text-[var(--mroya-brand-honey)]" />
                  <span>Визуальные состояния Inbox:</span>
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {[
                    { id: 'all', label: `Все (${proposals.length})` },
                    { id: 'new', label: `Новые (${proposals.filter((p) => p.status === 'new').length})` },
                    { id: 'reanalyzing', label: 'Повторный анализ' },
                    { id: 'accepted', label: 'Принято' },
                    { id: 'declined', label: 'Отклонено' },
                    { id: 'applied', label: 'Успешно применено' },
                    { id: 'outdated', label: 'Устаревшее' },
                    { id: 'error', label: 'Ошибка' },
                    { id: 'empty', label: 'Пустой Inbox' },
                    { id: 'loading', label: 'Загрузка' },
                  ].map((filterOption) => (
                    <button
                      key={filterOption.id}
                      type="button"
                      onClick={() => setInboxFilter(filterOption.id as any)}
                      className={`px-2.5 py-1 rounded-[6px] text-[11.5px] font-medium transition-colors cursor-pointer ${
                        inboxFilter === filterOption.id
                          ? 'bg-[var(--mroya-primary)] text-[var(--mroya-on-primary)] font-semibold shadow-xs'
                          : 'bg-[var(--mroya-surface-muted)]/60 hover:bg-[var(--mroya-surface-active)] text-[var(--mroya-text)] border border-[var(--mroya-divider)]'
                      }`}
                    >
                      {filterOption.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* STATE: LOADING */}
            {inboxFilter === 'loading' && (
              <div className="space-y-4 animate-in fade-in">
                {[1, 2, 3].map((skeleton) => (
                  <div
                    key={skeleton}
                    className="p-5 sm:p-6 rounded-[12px] bg-[var(--mroya-surface)] border border-[var(--mroya-divider)] space-y-4 animate-pulse"
                  >
                    <div className="flex items-center justify-between">
                      <div className="h-5 w-48 bg-[var(--mroya-surface-muted)] rounded" />
                      <div className="h-5 w-24 bg-[var(--mroya-surface-muted)] rounded-full" />
                    </div>
                    <div className="h-4 w-64 bg-[var(--mroya-surface-muted)] rounded" />
                    <div className="h-16 w-full bg-[var(--mroya-surface-muted)]/60 rounded-[8px]" />
                    <div className="flex items-center gap-2 pt-2">
                      <div className="h-8 w-20 bg-[var(--mroya-surface-muted)] rounded-full" />
                      <div className="h-8 w-20 bg-[var(--mroya-surface-muted)] rounded-full" />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* STATE: EMPTY INBOX */}
            {inboxFilter === 'empty' || (inboxFilter !== 'loading' && visibleProposals.length === 0) ? (
              <div className="p-10 rounded-[12px] bg-[var(--mroya-surface)] border border-[var(--mroya-divider)] text-center space-y-3 animate-in fade-in">
                <div className="w-12 h-12 mx-auto rounded-full bg-[var(--mroya-surface-muted)] border border-[var(--mroya-divider)] flex items-center justify-center text-[var(--mroya-text-muted)]">
                  <Inbox className="w-6 h-6" />
                </div>
                <h3 className="text-[16px] font-semibold text-[var(--mroya-text)]">
                  Все предложения обработаны
                </h3>
                <p className="text-[13px] text-[var(--mroya-text-muted)] max-w-md mx-auto leading-[20px]">
                  В Memory Inbox сейчас нет ожидающих предложений. Искусственный интеллект продолжит мониторинг разрешенных источников и сформирует предложения при появлении новых фактов.
                </p>
                <button
                  type="button"
                  onClick={handleResetProposals}
                  className="mt-2 px-4 py-2 rounded-full text-[12.5px] font-semibold bg-[var(--mroya-primary)] text-[var(--mroya-on-primary)] hover:bg-[var(--mroya-primary-hover)] transition-colors cursor-pointer"
                >
                  Показать примеры предложений
                </button>
              </div>
            ) : null}

            {/* LIST OF PROPOSAL CARDS */}
            {inboxFilter !== 'loading' && visibleProposals.length > 0 && (
              <div className="space-y-4">
                {visibleProposals.map((proposal) => {
                  const isNew = proposal.status === 'new';
                  const isReanalyzing = proposal.status === 'reanalyzing';
                  const isAccepted = proposal.status === 'accepted';
                  const isDeclined = proposal.status === 'declined';
                  const isApplied = proposal.status === 'applied';
                  const isOutdated = proposal.status === 'outdated';
                  const isError = proposal.status === 'error';

                  return (
                    <div
                      key={proposal.id}
                      className={`p-5 sm:p-6 rounded-[12px] bg-[var(--mroya-surface)] border transition-all ${
                        isNew
                          ? 'border-[var(--mroya-divider)] shadow-[var(--mroya-shadow-subtle)]'
                          : isReanalyzing
                          ? 'border-indigo-500/40 bg-indigo-500/5'
                          : isAccepted
                          ? 'border-emerald-500/30 bg-emerald-500/5'
                          : isApplied
                          ? 'border-emerald-600/40 bg-emerald-600/5'
                          : isDeclined
                          ? 'border-[var(--mroya-divider)] opacity-60 bg-[var(--mroya-surface-muted)]/40'
                          : isOutdated
                          ? 'border-amber-500/30 bg-amber-500/5'
                          : isError
                          ? 'border-red-500/40 bg-red-500/5'
                          : 'border-[var(--mroya-divider)]'
                      }`}
                    >
                      {/* Top Bar: Title & Status Badge */}
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 pb-3 border-b border-[var(--mroya-divider)]/60">
                        <div className="space-y-1">
                          <h3 className="text-[17px] font-semibold text-[var(--mroya-text)] leading-[24px]">
                            {proposal.title}
                          </h3>

                          {/* Source and Provenance row */}
                          <div className="flex flex-wrap items-center gap-2 text-[12px] text-[var(--mroya-text-muted)]">
                            <span className="inline-flex items-center gap-1 font-medium text-[var(--mroya-text)]">
                              {proposal.source === 'Calendar' && <CalendarIcon className="w-3.5 h-3.5 text-blue-500 shrink-0" />}
                              {proposal.source === 'Email' && <Mail className="w-3.5 h-3.5 text-amber-500 shrink-0" />}
                              {proposal.source === 'Drive' && <FileText className="w-3.5 h-3.5 text-emerald-500 shrink-0" />}
                              <span>{proposal.source === 'Calendar' ? 'Google Calendar' : proposal.source === 'Email' ? 'Gmail' : 'Google Drive'}</span>
                            </span>
                            <span aria-hidden="true">·</span>
                            <span>{proposal.sourceResourceTitle}</span>
                            <span aria-hidden="true">·</span>
                            <span className="tabular-nums">{proposal.sourceDate}</span>
                          </div>
                        </div>

                        {/* Status Badge */}
                        <div className="shrink-0 self-start">
                          {isNew && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11.5px] font-semibold bg-[var(--mroya-primary)]/15 text-[var(--mroya-primary)] border border-[var(--mroya-primary)]/30">
                              <Sparkles className="w-3 h-3" />
                              <span>Новое предложение</span>
                            </span>
                          )}
                          {isReanalyzing && (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11.5px] font-semibold bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border border-indigo-500/30">
                              <RefreshCw className="w-3 h-3 animate-spin" />
                              <span>Повторный анализ…</span>
                            </span>
                          )}
                          {isAccepted && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11.5px] font-semibold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                              <Check className="w-3 h-3" />
                              <span>Принято</span>
                            </span>
                          )}
                          {isApplied && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11.5px] font-semibold bg-emerald-600/20 text-emerald-800 dark:text-emerald-200 border border-emerald-600/30">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                              <span>Успешно применено</span>
                            </span>
                          )}
                          {isDeclined && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11.5px] font-semibold bg-zinc-500/15 text-zinc-600 dark:text-zinc-400 border border-zinc-500/30">
                              <X className="w-3 h-3" />
                              <span>Отклонено</span>
                            </span>
                          )}
                          {isOutdated && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11.5px] font-semibold bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                              <Clock className="w-3 h-3" />
                              <span>Устаревшее предложение</span>
                            </span>
                          )}
                          {isError && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11.5px] font-semibold bg-red-500/15 text-red-700 dark:text-red-300 border border-red-500/30">
                              <AlertCircle className="w-3 h-3" />
                              <span>Ошибка</span>
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Main Card Content */}
                      <div className="py-3.5 space-y-3.5">
                        {/* What the model proposes to do */}
                        <div className="p-3 rounded-[10px] bg-[var(--mroya-surface-muted)]/60 border border-[var(--mroya-divider)]">
                          <div className="text-[11.5px] uppercase tracking-wider text-[var(--mroya-text-muted)] font-semibold mb-1">
                            Что предлагает сделать AI:
                          </div>
                          <div className="text-[13.5px] font-semibold text-[var(--mroya-text)] leading-[20px]">
                            {proposal.actionProposed}
                          </div>
                        </div>

                        {/* Model explanation */}
                        <div className="flex items-start gap-2.5 p-3 rounded-[10px] bg-[var(--mroya-bg)] border border-[var(--mroya-divider)]/80 text-[13px] leading-[20px] text-[var(--mroya-text)]">
                          <Brain className="w-4 h-4 text-[var(--mroya-brand-honey)] shrink-0 mt-0.5" />
                          <div className="space-y-1">
                            <span className="text-[11px] font-semibold text-[var(--mroya-text-muted)] uppercase tracking-wider block">
                              Объяснение модели:
                            </span>
                            <p className="text-[13px] text-[var(--mroya-text)] leading-[20px]">
                              {proposal.explanation}
                            </p>
                          </div>
                        </div>

                        {/* Memory Matches Section */}
                        <div className="space-y-1.5">
                          <div className="text-[12px] font-semibold text-[var(--mroya-text)] flex items-center gap-1.5">
                            <Users className="w-3.5 h-3.5 text-[var(--mroya-primary)]" />
                            <span>Найденные совпадения в памяти:</span>
                          </div>

                          {proposal.memoryMatches.length > 0 ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              {proposal.memoryMatches.map((match) => (
                                <div
                                  key={match.id}
                                  className="p-2.5 rounded-[8px] bg-[var(--mroya-surface-muted)] border border-[var(--mroya-divider)] flex items-center justify-between gap-2"
                                >
                                  <div className="min-w-0">
                                    <div className="text-[13px] font-semibold text-[var(--mroya-text)] truncate">
                                      {match.name}
                                    </div>
                                    {match.relation && (
                                      <div className="text-[11.5px] text-[var(--mroya-text-muted)] truncate">
                                        {match.relation}
                                      </div>
                                    )}
                                  </div>
                                  {match.similarity && (
                                    <span className="px-2 py-0.5 rounded text-[10.5px] font-medium bg-[var(--mroya-surface-active)] text-[var(--mroya-primary)] shrink-0">
                                      {match.similarity}
                                    </span>
                                  )}
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="p-2.5 rounded-[8px] bg-[var(--mroya-surface-muted)]/50 border border-[var(--mroya-divider)] text-[12px] text-[var(--mroya-text-muted)] flex items-center gap-2">
                              <User className="w-3.5 h-3.5 text-[var(--mroya-text-muted)] shrink-0" />
                              <span>Совпадений в существующей памяти не найдено (новый объект). Информация не подтверждена до вашего одобрения.</span>
                            </div>
                          )}
                        </div>

                        {/* REANALYZING ACTIVE FEEDBACK BLOCK */}
                        {isReanalyzing && (
                          <div className="p-3.5 rounded-[10px] bg-indigo-500/10 border border-indigo-500/20 space-y-1.5">
                            <div className="flex items-center gap-2 text-indigo-700 dark:text-indigo-300 text-[13px] font-semibold">
                              <RefreshCw className="w-4 h-4 animate-spin shrink-0 text-indigo-600 dark:text-indigo-400" />
                              <span>Повторный семантический анализ с учетом вашего комментария…</span>
                            </div>
                            {proposal.comment && (
                              <p className="text-[12px] text-[var(--mroya-text)] italic pl-6">
                                «{proposal.comment}»
                              </p>
                            )}
                            <div className="pt-2 flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => handleAcceptProposal(proposal.id)}
                                className="px-3 py-1 rounded-[6px] text-[11.5px] font-semibold bg-indigo-600 text-white hover:bg-indigo-700 cursor-pointer"
                              >
                                Завершить анализ (Принять)
                              </button>
                            </div>
                          </div>
                        )}

                        {/* APPLIED CONFIRMATION BLOCK */}
                        {isApplied && (
                          <div className="p-3.5 rounded-[10px] bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-200 text-[13px]">
                              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                              <span>Успешно сохранено в долговременную память. Карточка обновлена.</span>
                            </div>
                            <button
                              type="button"
                              onClick={() => setActiveMainTab('memories')}
                              className="text-[12px] font-semibold text-[var(--mroya-primary)] hover:underline whitespace-nowrap cursor-pointer"
                            >
                              Перейти в память →
                            </button>
                          </div>
                        )}

                        {/* OUTDATED REASON BLOCK */}
                        {isOutdated && (
                          <div className="p-3 rounded-[10px] bg-amber-500/10 border border-amber-500/25 flex items-center gap-2 text-amber-800 dark:text-amber-300 text-[12.5px]">
                            <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400" />
                            <span>Исходное событие было удалено из календаря. Предложение архивировано.</span>
                          </div>
                        )}

                        {/* ERROR NOTICE BLOCK */}
                        {isError && (
                          <div className="p-3.5 rounded-[10px] bg-red-500/10 border border-red-500/25 space-y-2">
                            <div className="flex items-center gap-2 text-red-800 dark:text-red-300 text-[13px] font-semibold">
                              <AlertCircle className="w-4 h-4 shrink-0 text-red-600 dark:text-red-400" />
                              <span>Ошибка обработки предложения</span>
                            </div>
                            {proposal.errorMessage && (
                              <p className="text-[12px] text-red-700 dark:text-red-300">
                                {proposal.errorMessage}
                              </p>
                            )}
                            <button
                              type="button"
                              onClick={() => handleRetryProposal(proposal.id)}
                              className="px-3 py-1.5 rounded-[6px] text-[12px] font-semibold bg-red-600 text-white hover:bg-red-700 cursor-pointer inline-flex items-center gap-1.5"
                            >
                              <RefreshCw className="w-3.5 h-3.5" />
                              <span>Повторить запрос</span>
                            </button>
                          </div>
                        )}

                        {/* DECLINED NOTICE BLOCK */}
                        {isDeclined && (
                          <div className="p-3 rounded-[10px] bg-[var(--mroya-surface-muted)] border border-[var(--mroya-divider)] flex items-center justify-between gap-3 text-[12.5px] text-[var(--mroya-text-muted)]">
                            <span>Предложение отклонено. Модель учла это для последующих предложений.</span>
                            <button
                              type="button"
                              onClick={() => handleAcceptProposal(proposal.id)}
                              className="text-[12px] font-semibold text-[var(--mroya-primary)] hover:underline cursor-pointer"
                            >
                              Отменить отклонение
                            </button>
                          </div>
                        )}

                        {/* COMMENT INPUT DRAWER */}
                        {proposal.isCommentOpen && (
                          <div className="p-3.5 rounded-[10px] bg-[var(--mroya-surface-muted)]/70 border border-[var(--mroya-divider)] space-y-2.5 animate-in fade-in">
                            <div className="flex items-center justify-between">
                              <label
                                htmlFor={`comment-${proposal.id}`}
                                className="block text-[12px] font-semibold text-[var(--mroya-text)]"
                              >
                                Комментарий для повторного анализа AI:
                              </label>
                              <button
                                type="button"
                                onClick={() => handleToggleComment(proposal.id)}
                                className="text-[11px] text-[var(--mroya-text-muted)] hover:text-[var(--mroya-text)]"
                              >
                                Закрыть
                              </button>
                            </div>

                            <textarea
                              id={`comment-${proposal.id}`}
                              rows={2}
                              value={proposal.draftComment ?? ''}
                              onChange={(e) => handleDraftCommentChange(proposal.id, e.target.value)}
                              placeholder="Например: «Марк — мой сын» или «Дмитрий и Татьяна Мурашко — мои друзья»..."
                              className="w-full p-2.5 rounded-[8px] bg-[var(--mroya-surface)] border border-[var(--mroya-input-outline)] text-[13px] text-[var(--mroya-text)] placeholder-[var(--mroya-text-muted)] focus:outline-none focus:border-[var(--mroya-primary)]"
                            />

                            {proposal.suggestedComment && (
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-[11px] text-[var(--mroya-text-muted)]">Пример уточнения:</span>
                                <button
                                  type="button"
                                  onClick={() => handleDraftCommentChange(proposal.id, proposal.suggestedComment || '')}
                                  className="px-2 py-0.5 rounded text-[11px] bg-[var(--mroya-surface-active)] text-[var(--mroya-primary)] hover:underline cursor-pointer"
                                >
                                  «{proposal.suggestedComment}»
                                </button>
                              </div>
                            )}

                            <div className="flex items-center justify-end gap-2 pt-1">
                              <button
                                type="button"
                                onClick={() => handleToggleComment(proposal.id)}
                                className="px-3 py-1.5 rounded-[8px] text-[12px] font-medium text-[var(--mroya-text-muted)] hover:bg-[var(--mroya-surface-active)]"
                              >
                                Отмена
                              </button>
                              <button
                                type="button"
                                onClick={() => handleSendComment(proposal.id)}
                                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-[8px] text-[12px] font-semibold bg-[var(--mroya-primary)] hover:bg-[var(--mroya-primary-hover)] text-[var(--mroya-on-primary)] transition-colors cursor-pointer"
                              >
                                <Send className="w-3.5 h-3.5" />
                                <span>Отправить на повторный анализ</span>
                              </button>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Bottom Action Bar: Да / Нет / Комментарий */}
                      {!isDeclined && !isApplied && (
                        <div className="pt-3.5 border-t border-[var(--mroya-divider)]/60 flex flex-wrap items-center justify-between gap-2.5">
                          {isAccepted ? (
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => handleApplyProposal(proposal.id)}
                                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-[13px] font-semibold bg-emerald-600 hover:bg-emerald-700 text-white transition-colors cursor-pointer"
                              >
                                <CheckCircle2 className="w-4 h-4" />
                                <span>Применить в память</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeclineProposal(proposal.id)}
                                className="px-3 py-1.5 rounded-full text-[12px] font-medium text-[var(--mroya-text-muted)] hover:text-[var(--mroya-text)] cursor-pointer"
                              >
                                Отменить
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2 flex-wrap">
                              {/* 1: ДА — принять предложение */}
                              <button
                                type="button"
                                onClick={() => handleAcceptProposal(proposal.id)}
                                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-[13px] font-semibold bg-[var(--mroya-primary)] hover:bg-[var(--mroya-primary-hover)] text-[var(--mroya-on-primary)] transition-colors cursor-pointer shadow-xs"
                              >
                                <Check className="w-4 h-4" />
                                <span>Да</span>
                              </button>

                              {/* 2: НЕТ — отклонить предложение */}
                              <button
                                type="button"
                                onClick={() => handleDeclineProposal(proposal.id)}
                                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-[13px] font-semibold bg-[var(--mroya-surface-muted)] hover:bg-[var(--mroya-surface-active)] text-[var(--mroya-text)] border border-[var(--mroya-divider)] transition-colors cursor-pointer"
                              >
                                <X className="w-4 h-4" />
                                <span>Нет</span>
                              </button>

                              {/* 3: КОММЕНТАРИЙ — открыть текстовое поле */}
                              <button
                                type="button"
                                onClick={() => handleToggleComment(proposal.id)}
                                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-[13px] font-medium bg-[var(--mroya-surface-muted)] hover:bg-[var(--mroya-surface-active)] text-[var(--mroya-text)] border border-[var(--mroya-divider)] transition-colors cursor-pointer"
                              >
                                <MessageSquare className="w-3.5 h-3.5 text-[var(--mroya-primary)]" />
                                <span>Комментарий</span>
                              </button>
                            </div>
                          )}

                          <div className="text-[11.5px] text-[var(--mroya-text-muted)]">
                            Требует подтверждения пользователя
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Add Memory Modal (preserved) */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-[1px]">
          <div className="w-full max-w-md rounded-[14px] bg-[var(--mroya-surface)] border border-[var(--mroya-divider)] shadow-[var(--mroya-shadow-elevated)] p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-[16px] font-semibold text-[var(--mroya-text)]">
                Tell Mroya something to remember
              </h2>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                aria-label="Close modal"
                className="w-7 h-7 rounded-lg inline-flex items-center justify-center text-[var(--mroya-text-muted)] hover:text-[var(--mroya-text)]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateMemory} className="space-y-3.5">
              <div>
                <label className="block text-[12px] font-semibold text-[var(--mroya-text)] mb-1">
                  Title
                </label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="e.g., Preferred meeting time"
                  className="w-full px-3 py-2 rounded-[8px] bg-[var(--mroya-surface)] border border-[var(--mroya-input-outline)] text-[14px] text-[var(--mroya-text)]"
                />
              </div>

              <div>
                <label className="block text-[12px] font-semibold text-[var(--mroya-text)] mb-1">
                  Category
                </label>
                <select
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value as MemoryCategory)}
                  className="w-full px-3 py-2 rounded-[8px] bg-[var(--mroya-surface)] border border-[var(--mroya-input-outline)] text-[14px] text-[var(--mroya-text)]"
                >
                  <option value="Agreements & Decisions">Agreements & Decisions</option>
                  <option value="People & Clients">People & Clients</option>
                  <option value="Dates & Commitments">Dates & Commitments</option>
                  <option value="Preferences">Preferences</option>
                </select>
              </div>

              <div>
                <label className="block text-[12px] font-semibold text-[var(--mroya-text)] mb-1">
                  Fact or agreement details
                </label>
                <textarea
                  rows={3}
                  required
                  value={newSummary}
                  onChange={(e) => setNewSummary(e.target.value)}
                  placeholder="Write what Mroya should remember for future conversations..."
                  className="w-full px-3 py-2 rounded-[8px] bg-[var(--mroya-surface)] border border-[var(--mroya-input-outline)] text-[14px] text-[var(--mroya-text)]"
                />
              </div>

              <div>
                <label className="block text-[12px] font-semibold text-[var(--mroya-text)] mb-1">
                  Related people or organizations (comma-separated)
                </label>
                <input
                  type="text"
                  value={newEntities}
                  onChange={(e) => setNewEntities(e.target.value)}
                  className="w-full px-3 py-2 rounded-[8px] bg-[var(--mroya-surface)] border border-[var(--mroya-input-outline)] text-[14px] text-[var(--mroya-text)]"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 rounded-full bg-[var(--mroya-surface-muted)] text-[13px] font-medium text-[var(--mroya-text)]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-[var(--mroya-primary)] hover:bg-[var(--mroya-primary-hover)] text-[var(--mroya-on-primary)] text-[13px] font-semibold cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  <span>Save to memory</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
