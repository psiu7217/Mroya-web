// Shared Studio visuals. Production uses inert, explicitly labelled public examples.
import React,{useState} from 'react';
import {Sparkles,Check,Clock,User,Building2,MapPin,Brain,ExternalLink,CheckCircle2,HelpCircle,AlertTriangle,Calendar as CalendarIcon,RefreshCw,AlertCircle} from 'lucide-react';
import type {CalendarEvent} from '../types/mroya';

export function EventAnalysisPreview({preview=true,event,variant='conflict',onViewProposal}:{preview?:boolean;event?:CalendarEvent;variant?:'unavailable'|'queued'|'conflict'|'standard';onViewProposal?:()=>void}) {
 // A Production example never receives or derives claims from a real event/memory.
 const viewingEvent=preview?{id:'public-illustration',title:'Пример встречи',person:'Пример участника',organization:'Пример компании',locationOrLink:'Пример места'}:event!;
 const [confirmedAiProposals,setConfirmedAiProposals]=useState<Record<string,boolean>>({});
 return (<div className="pt-3 space-y-3">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="text-[12.5px] font-semibold text-[var(--mroya-text)] flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-[var(--mroya-brand-honey)]" />
                    <span>Memory Intelligence · Анализ события · Preview</span>
                  </div>

                  {/* Analysis Status Badge */}
                  <div>
                    {preview ? <span className="text-[11px] font-semibold text-[var(--mroya-text-muted)]">Пример · Soon</span> : confirmedAiProposals[viewingEvent.id] ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                        <Check className="w-3 h-3" />
                        <span>Предложение принято</span>
                      </span>
                    ) : variant === 'unavailable' ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-[var(--mroya-surface-muted)] text-[var(--mroya-text-muted)] border border-[var(--mroya-divider)]">
                        <Clock className="w-3 h-3" />
                        <span>Анализ недоступен</span>
                      </span>
                    ) : variant === 'queued' ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                        <Clock className="w-3 h-3" />
                        <span>В очереди на анализ</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-500/30">
                        <Sparkles className="w-3 h-3 text-blue-600 dark:text-blue-400" />
                        <span>Проанализировано AI</span>
                      </span>
                    )}
                  </div>
                </div>

                {/* Extracted Entities */}
                <div className="p-3 rounded-[10px] bg-[var(--mroya-surface-muted)]/70 border border-[var(--mroya-divider)] space-y-2">
                  <div className="text-[11px] uppercase tracking-wider text-[var(--mroya-text-muted)] font-semibold">
                    Извлечённые сущности:
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[12px]">
                    <div className="flex items-center gap-2 p-1.5 rounded bg-[var(--mroya-surface)] border border-[var(--mroya-divider)]/60">
                      <User className="w-3.5 h-3.5 text-[var(--mroya-primary)] shrink-0" />
                      <div className="truncate">
                        <span className="text-[var(--mroya-text-muted)]">Участник: </span>
                        <span className="font-medium text-[var(--mroya-text)]">{viewingEvent.person || 'Александр Белов (Сашка)'}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 p-1.5 rounded bg-[var(--mroya-surface)] border border-[var(--mroya-divider)]/60">
                      <Building2 className="w-3.5 h-3.5 text-[var(--mroya-primary)] shrink-0" />
                      <div className="truncate">
                        <span className="text-[var(--mroya-text-muted)]">Компания: </span>
                        <span className="font-medium text-[var(--mroya-text)]">{viewingEvent.organization || 'Архитектурное бюро'}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 p-1.5 rounded bg-[var(--mroya-surface)] border border-[var(--mroya-divider)]/60">
                      <MapPin className="w-3.5 h-3.5 text-[var(--mroya-primary)] shrink-0" />
                      <div className="truncate">
                        <span className="text-[var(--mroya-text-muted)]">Локация: </span>
                        <span className="font-medium text-[var(--mroya-text)]">{viewingEvent.locationOrLink || 'Кофейня на Немиге / Google Meet'}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 p-1.5 rounded bg-[var(--mroya-surface)] border border-[var(--mroya-divider)]/60">
                      <Brain className="w-3.5 h-3.5 text-[var(--mroya-brand-honey)] shrink-0" />
                      <div className="truncate">
                        <span className="text-[var(--mroya-text-muted)]">Договоренность: </span>
                        <span className="font-medium text-[var(--mroya-text)]">Согласование эскизов фасада</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Proposed for Memory Card */}
                <div className="p-3.5 rounded-[10px] bg-[var(--mroya-bg)] border border-[var(--mroya-primary)]/40 space-y-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-0.5">
                      <div className="text-[11.5px] uppercase tracking-wider font-semibold text-[var(--mroya-primary)] flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>Предложено для памяти:</span>
                      </div>
                      <p className="text-[13px] font-semibold text-[var(--mroya-text)]">
                        {variant === 'conflict'
                          ? 'Пример: связать встречу с контактом и зафиксировать срок эскизов'
                          : `Связать событие «${viewingEvent.title}» с карточкой контакта в долговременной памяти`}
                      </p>
                    </div>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/25 shrink-0">
                      Кандидат
                    </span>
                  </div>

                  <p className="text-[12px] text-[var(--mroya-text-muted)] leading-[18px]">
                    Пример результата: сходство 94%. Это иллюстрация будущего анализа, а не результат обработки вашего события или памяти.
                  </p>

                  <div className="flex items-center justify-between pt-1 gap-2 flex-wrap">
                    <button
                      type="button"
                      disabled={preview}
                      title={preview?'Функция скоро появится':undefined}
                      onClick={preview?undefined:onViewProposal}
                      className="text-[12px] font-semibold text-[var(--mroya-primary)] hover:underline inline-flex items-center gap-1 cursor-pointer"
                    >
                      <span>Перейти к предложению в Inbox{preview?' · Soon':''}</span>
                      <ExternalLink className="w-3 h-3" />
                    </button>
                    {!confirmedAiProposals[viewingEvent.id] ? (
                      <button
                        type="button"
                        disabled={preview}
                        title={preview?'Функция скоро появится':undefined}
                        onClick={preview?undefined:() => setConfirmedAiProposals((prev) => ({ ...prev, [viewingEvent.id]: true }))}
                        className="px-3 py-1 rounded-[6px] bg-[var(--mroya-primary)] hover:bg-[var(--mroya-primary-hover)] text-[var(--mroya-on-primary)] text-[11.5px] font-semibold transition-colors cursor-pointer shadow-xs inline-flex items-center gap-1"
                      >
                        <Check className="w-3 h-3" />
                        <span>Подтвердить факт{preview?' · Soon':''}</span>
                      </button>
                    ) : (
                      <span className="text-[11.5px] font-semibold text-emerald-600 dark:text-emerald-400 inline-flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Подтверждено</span>
                      </span>
                    )}
                  </div>
                </div>

                {/* AI Uncertainty Indicator */}
                <div className="p-2.5 rounded-[8px] bg-amber-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-200 text-[12px] flex items-start gap-2">
                  <HelpCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold">Индикатор неуверенности AI: </span>
                    <span>Пример неопределённости: личная консультация или рабочий проект. Результат показан только для иллюстрации.</span>
                  </div>
                </div>

                {/* Conflict Warning */}
                {variant === 'conflict' && (
                  <div className="p-2.5 rounded-[8px] bg-red-500/10 border border-red-500/25 text-red-800 dark:text-red-300 text-[12px] flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-semibold">Предупреждение о конфликте: </span>
                      <span>Пример конфликта: предполагаемый отпуск участника пересекается со встречей. Это не сведения из вашей памяти.</span>
                    </div>
                  </div>
                )}
              </div>);
};
export function IntelligenceSourcesPreview({preview=true}:{preview?:boolean}) {
 const [calendarAnalysisEnabled,setCalendarAnalysisEnabled]=useState(true);
 const [calendarAnalysisSpecific,setCalendarAnalysisSpecific]=useState<Record<string,boolean>>({work:true,personal:false,holidays:false});
 return (<div className="p-5 rounded-[12px] bg-[var(--mroya-surface)] border border-[var(--mroya-divider)] space-y-4">
                  <div className="flex items-center gap-2.5">
                    <Brain className="w-5 h-5 text-[var(--mroya-brand-honey)]" />
                    <div>
                      <h3 className="text-[15px] font-semibold text-[var(--mroya-text)]">
                        Memory Intelligence · Разрешения источников · Preview
                      </h3>
                      <p className="text-[12.5px] text-[var(--mroya-text-muted)] mt-0.5">
                        {preview?'Пример · Soon. Календари ниже — иллюстрация, а не ваши источники. Функция скоро появится.':'Design preview: выберите источники для локальной симуляции.'}
                      </p>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-[var(--mroya-divider)] space-y-3">
                    {/* Google Calendar Master Switch */}
                    <div className="p-3.5 rounded-[10px] bg-[var(--mroya-surface-muted)]/60 border border-[var(--mroya-divider)] flex items-center justify-between gap-3">
                      <div className="space-y-0.5">
                        <div className="text-[13.5px] font-semibold text-[var(--mroya-text)] flex items-center gap-2">
                          <CalendarIcon className="w-4 h-4 text-[var(--mroya-primary)]" />
                          <span>Google Calendar — Анализ событий</span>
                        </div>
                        <p className="text-[12px] text-[var(--mroya-text-muted)]">
                          Разрешить модели анализировать встречи для поиска новых договоренностей и фактов
                        </p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer select-none shrink-0">
                        <input
                          type="checkbox"
                          checked={calendarAnalysisEnabled}
                          disabled={preview}
                          onChange={preview?undefined:(e) => setCalendarAnalysisEnabled(e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className="w-9 h-5 bg-[var(--mroya-surface-muted)] border border-[var(--mroya-divider)] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-[var(--mroya-text)] peer-checked:after:bg-[var(--mroya-on-primary)] peer-checked:bg-[var(--mroya-primary)] after:rounded-full after:h-4 after:w-4 after:transition-all"></div>
                      </label>
                    </div>

                    {/* Granular Calendar Permissions */}
                    {calendarAnalysisEnabled && (
                      <div className="pl-3 border-l-2 border-[var(--mroya-primary)]/40 space-y-2 pt-1 animate-in fade-in duration-150">
                        <div className="text-[11.5px] uppercase tracking-wider text-[var(--mroya-text-muted)] font-semibold">
                          Разрешения для конкретных календарей:
                        </div>
                        <div className="space-y-1.5">
                          {[
                            { id: 'work', name: 'Рабочий календарь (Work)', desc: 'Встречи, клиенты, спринты и договоренности', defaultActive: true },
                            { id: 'personal', name: 'Личный календарь (Personal)', desc: 'Личные планы, тренировки и частные дела', defaultActive: false },
                            { id: 'holidays', name: 'Праздники и контакты', desc: 'Дни рождения и государственные праздники', defaultActive: false },
                          ].map((cal) => {
                            const isActive = calendarAnalysisSpecific[cal.id] ?? cal.defaultActive;
                            return (
                              <label
                                key={cal.id}
                                className="flex items-center justify-between p-2.5 rounded-[8px] bg-[var(--mroya-surface)] hover:bg-[var(--mroya-surface-muted)] border border-[var(--mroya-divider)] cursor-pointer transition-colors"
                              >
                                <div className="min-w-0 pr-2">
                                  <div className="text-[13px] font-medium text-[var(--mroya-text)] truncate">
                                    {cal.name}
                                  </div>
                                  <div className="text-[11px] text-[var(--mroya-text-muted)] truncate">
                                    {cal.desc}
                                  </div>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                  <span className={`text-[11px] font-semibold ${isActive ? 'text-emerald-600 dark:text-emerald-400' : 'text-[var(--mroya-text-muted)]'}`}>
                                    {isActive ? 'Анализировать' : 'Игнорировать'}
                                  </span>
                                  <input
                                    type="checkbox"
                                    checked={isActive}
                                    disabled={preview}
                                    onChange={preview?undefined:() =>
                                      setCalendarAnalysisSpecific((prev) => ({
                                        ...prev,
                                        [cal.id]: !isActive,
                                      }))
                                    }
                                    className="w-4 h-4 rounded text-[var(--mroya-primary)] accent-[var(--mroya-primary)] cursor-pointer"
                                  />
                                </div>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Future Sources placeholders */}
                    <div className="pt-2 border-t border-[var(--mroya-divider)] space-y-2">
                      <div className="text-[11.5px] uppercase tracking-wider text-[var(--mroya-text-muted)] font-semibold">
                        Планируемые источники для Memory Intelligence:
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[12px]">
                        <div className="p-2.5 rounded-[8px] bg-[var(--mroya-surface-muted)]/40 border border-[var(--mroya-divider)] flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-[var(--mroya-text)]">Gmail (Анализ писем)</span>
                          </div>
                          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-[var(--mroya-surface)] text-[var(--mroya-text-muted)] border border-[var(--mroya-divider)]">
                            В разработке
                          </span>
                        </div>
                        <div className="p-2.5 rounded-[8px] bg-[var(--mroya-surface-muted)]/40 border border-[var(--mroya-divider)] flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-[var(--mroya-text)]">Google Drive (Документы)</span>
                          </div>
                          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-[var(--mroya-surface)] text-[var(--mroya-text-muted)] border border-[var(--mroya-divider)]">
                            В разработке
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>);
};
export function IntelligenceAutonomyPreview({preview=true}:{preview?:boolean}) {
 const [autonomyLevel,setAutonomyLevel]=useState<'manual'|'auto_link'|'auto_save'>('auto_link');
 const [autonomySaveStatus,setAutonomySaveStatus]=useState<'saving'|'saved'|'error'>('saved');
 return (<div className="p-5 rounded-[12px] bg-[var(--mroya-surface)] border border-[var(--mroya-divider)] space-y-4">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2.5">
                    <Sparkles className="w-5 h-5 text-[var(--mroya-brand-honey)]" />
                    <div>
                      <h2 className="text-[16px] font-semibold text-[var(--mroya-text)]">
                        Автономность Memory Intelligence · Preview
                      </h2>
                      <p className="text-[12.5px] text-[var(--mroya-text-muted)] mt-0.5">
                        {preview?'Preview · Soon. Пример будущей настройки, не текущая политика сохранения вашей памяти.':'Design preview: локальная симуляция настройки автономности.'}
                      </p>
                    </div>
                  </div>

                  {/* Save Status Indicator */}
                  <div className="text-[12px]">
                    {!preview && autonomySaveStatus === 'saving' && (
                      <span className="inline-flex items-center gap-1.5 text-[var(--mroya-text-muted)] font-medium">
                        <RefreshCw className="w-3.5 h-3.5 animate-spin text-[var(--mroya-primary)]" />
                        <span>Сохранение…</span>
                      </span>
                    )}
                    {autonomySaveStatus === 'saved' && (
                      <span className="inline-flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-semibold">
                        <Check className="w-3.5 h-3.5" />
                        <span>{preview?'Soon':'Сохранено · Simulation'}</span>
                      </span>
                    )}
                    {!preview && autonomySaveStatus === 'error' && (
                      <span className="inline-flex items-center gap-1.5 text-red-600 dark:text-red-400 font-semibold">
                        <AlertCircle className="w-3.5 h-3.5" />
                        <span>Ошибка сохранения</span>
                      </span>
                    )}
                  </div>
                </div>

                {/* 3 Autonomy Levels */}
                <div className="grid grid-cols-1 gap-2.5 pt-2">
                  {/* Option 1: Manual */}
                  <label
                    onClick={preview?undefined:() => {
                      setAutonomyLevel('manual');
                      setAutonomySaveStatus('saved');
                    }}
                    className={`p-3.5 rounded-[10px] border cursor-pointer transition-colors block ${
                      autonomyLevel === 'manual'
                        ? 'bg-[var(--mroya-surface-active)] border-[var(--mroya-primary)]'
                        : 'bg-[var(--mroya-surface-muted)]/60 hover:bg-[var(--mroya-surface-muted)] border-[var(--mroya-divider)]'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-2.5">
                        <input
                          type="radio"
                          name="memory_autonomy"
                          checked={autonomyLevel === 'manual'}
                          disabled={preview}
                          onChange={preview?undefined:() => {
                            setAutonomyLevel('manual');
                            setAutonomySaveStatus('saved');
                          }}
                          className="mt-1 w-4 h-4 text-[var(--mroya-primary)] accent-[var(--mroya-primary)]"
                        />
                        <div>
                          <div className="text-[13.5px] font-semibold text-[var(--mroya-text)]">
                            Ручное подтверждение
                          </div>
                          <p className="text-[12px] text-[var(--mroya-text-muted)] mt-0.5 leading-[18px]">
                            Все предложения требуют явного нажатия «Да» в Memory Inbox. Модель ничего не сохраняет и не связывает без вашего одобрения.
                          </p>
                        </div>
                      </div>
                    </div>
                  </label>

                  {/* Option 2: Automatic Links (Recommended — Visual Accent) */}
                  <label
                    onClick={preview?undefined:() => {
                      setAutonomyLevel('auto_link');
                      setAutonomySaveStatus('saved');
                    }}
                    className={`p-3.5 rounded-[10px] border-2 cursor-pointer transition-colors block relative ${
                      autonomyLevel === 'auto_link'
                        ? 'bg-[var(--mroya-primary)]/10 border-[var(--mroya-primary)] shadow-xs'
                        : 'bg-[var(--mroya-surface-muted)]/80 hover:bg-[var(--mroya-surface-muted)] border-[var(--mroya-primary)]/50'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-2.5">
                        <input
                          type="radio"
                          name="memory_autonomy"
                          checked={autonomyLevel === 'auto_link'}
                          disabled={preview}
                          onChange={preview?undefined:() => {
                            setAutonomyLevel('auto_link');
                            setAutonomySaveStatus('saved');
                          }}
                          className="mt-1 w-4 h-4 text-[var(--mroya-primary)] accent-[var(--mroya-primary)]"
                        />
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-[13.5px] font-bold text-[var(--mroya-text)]">
                              Автоматические связи
                            </span>
                            <span className="px-2 py-0.5 rounded-full text-[10.5px] font-bold uppercase tracking-wider bg-[var(--mroya-primary)] text-[var(--mroya-on-primary)] shadow-2xs">
                              Рекомендуется
                            </span>
                          </div>
                          <p className="text-[12px] text-[var(--mroya-text-muted)] mt-0.5 leading-[18px]">
                            События и письма связываются с уже известными сущностями автоматически. Новые контакты и факты создаются только после ручного подтверждения.
                          </p>
                        </div>
                      </div>
                    </div>
                  </label>

                  {/* Option 3: Automatic Save */}
                  <label
                    onClick={preview?undefined:() => {
                      setAutonomyLevel('auto_save');
                      setAutonomySaveStatus('saved');
                    }}
                    className={`p-3.5 rounded-[10px] border cursor-pointer transition-colors block ${
                      autonomyLevel === 'auto_save'
                        ? 'bg-[var(--mroya-surface-active)] border-[var(--mroya-primary)]'
                        : 'bg-[var(--mroya-surface-muted)]/60 hover:bg-[var(--mroya-surface-muted)] border-[var(--mroya-divider)]'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-2.5">
                        <input
                          type="radio"
                          name="memory_autonomy"
                          checked={autonomyLevel === 'auto_save'}
                          disabled={preview}
                          onChange={preview?undefined:() => {
                            setAutonomyLevel('auto_save');
                            setAutonomySaveStatus('saved');
                          }}
                          className="mt-1 w-4 h-4 text-[var(--mroya-primary)] accent-[var(--mroya-primary)]"
                        />
                        <div>
                          <div className="text-[13.5px] font-semibold text-[var(--mroya-text)]">
                            Автоматическое сохранение
                          </div>
                          <p className="text-[12px] text-[var(--mroya-text-muted)] mt-0.5 leading-[18px]">
                            Модель самостоятельно сохраняет факты с высокой уверенностью (&gt;90%). Спорные и неоднозначные случаи направляются в Memory Inbox.
                          </p>
                        </div>
                      </div>
                    </div>
                  </label>
                </div>

                {/* Design Mode State Preview Switcher */}
                {!preview && (
                  <div className="pt-3 border-t border-[var(--mroya-divider)] flex items-center justify-between text-[11.5px] text-[var(--mroya-text-muted)] flex-wrap gap-2">
                    <span>Тест состояний сохранения:</span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setAutonomySaveStatus('saving')}
                        className={`px-2 py-0.5 rounded border text-[11px] ${autonomySaveStatus === 'saving' ? 'bg-[var(--mroya-surface-active)] font-semibold' : ''}`}
                      >
                        Сохранение...
                      </button>
                      <button
                        type="button"
                        onClick={() => setAutonomySaveStatus('saved')}
                        className={`px-2 py-0.5 rounded border text-[11px] ${autonomySaveStatus === 'saved' ? 'bg-[var(--mroya-surface-active)] font-semibold' : ''}`}
                      >
                        Сохранено
                      </button>
                      <button
                        type="button"
                        onClick={() => setAutonomySaveStatus('error')}
                        className={`px-2 py-0.5 rounded border text-[11px] ${autonomySaveStatus === 'error' ? 'bg-[var(--mroya-surface-active)] font-semibold' : ''}`}
                      >
                        Ошибка
                      </button>
                    </div>
                  </div>
                )}
              </div>);
};
