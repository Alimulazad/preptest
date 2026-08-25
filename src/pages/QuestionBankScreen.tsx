import React, { useState, useMemo, useEffect } from 'react';
import {
  Search,
  X,
  ArrowLeft,
  BookOpen,
  GraduationCap,
  Calculator,
  Stethoscope,
  BookMarked,
  Pencil,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Layers,
  Award,
  Atom,
  Zap,
  FlaskConical,
  Dna,
  Laptop,
  Languages,
  Globe2,
  Calendar,
  CheckCircle2,
  FileText,
  Eye,
  EyeOff
} from 'lucide-react';
import { SubjectInfo, Question, WrittenQuestion, ExamCategory, QuestionSubject, Chapter } from '../types';
import { SUBJECTS_DATA, UNIVERSITIES_DATA, CHAPTERS_DATA } from '../data/admissionData';
import { COMPREHENSIVE_CHAPTERS_DATA } from '../data/subjectTopicsData';
import { INITIAL_WRITTEN_QUESTIONS } from '../data/writtenQuestionsData';
import QuestionCard from '../components/QuestionCard';
import WrittenQuestionCard from '../components/WrittenQuestionCard';
import EmptyState from '../components/common/EmptyState';
import { QuestionListSkeleton } from '../components/common/SkeletonLoader';

interface QuestionBankScreenProps {
  questions: Question[];
  writtenQuestions?: WrittenQuestion[];
  bookmarks: string[];
  onToggleBookmark: (id: string) => void;
  onAskAI: (question: Question | WrittenQuestion) => void;
  isLoading?: boolean;
}

export function matchesCategory(q: Question, category: ExamCategory): boolean {
  if (q.category && q.category === category) return true;
  const tagsStr = (q.tags || []).join(' ').toLowerCase();
  if (category === 'engineering') {
    return (
      tagsStr.includes('buet') ||
      tagsStr.includes('engineering') ||
      tagsStr.includes('sust') ||
      tagsStr.includes('ckruet') ||
      tagsStr.includes('cuet') ||
      tagsStr.includes('ruet') ||
      tagsStr.includes('kuet') ||
      tagsStr.includes('iut')
    );
  }
  if (category === 'medical') {
    return tagsStr.includes('medical') || tagsStr.includes('mbbs') || tagsStr.includes('dental') || tagsStr.includes('mat');
  }
  if (category === 'varsity_a') {
    return (
      tagsStr.includes('du') ||
      tagsStr.includes('varsity') ||
      tagsStr.includes('gst') ||
      tagsStr.includes('bup') ||
      tagsStr.includes('ru') ||
      tagsStr.includes('cu') ||
      tagsStr.includes('ju') ||
      tagsStr.includes('agri')
    );
  }
  if (category === 'academic') {
    return tagsStr.includes('board') || tagsStr.includes('hsc') || tagsStr.includes('academic') || tagsStr.includes('dhaka board');
  }
  if (category === 'main_book') {
    return tagsStr.includes('main book') || tagsStr.includes('textbook') || tagsStr.includes('মূলবই') || tagsStr.includes('অনুশীলনী');
  }
  return false;
}

// Category visual cards config
interface CategoryCardConfig {
  id: ExamCategory;
  label: string;
  gradient: string;
  bgSolid: string;
  textColor: string;
  icon: React.ReactNode;
  illustrationType: 'academic' | 'main_book' | 'engineering' | 'medical' | 'varsity';
}

const toBengaliNumber = (num: number | string): string => {
  const bnDigits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
  return String(num).replace(/[0-9]/g, (d) => bnDigits[parseInt(d, 10)]);
};

const CATEGORY_CARDS_CONFIG: CategoryCardConfig[] = [
  {
    id: 'academic',
    label: 'একাডেমিক',
    gradient: 'from-[#CA8A04] via-[#D97706] to-[#B45309]',
    bgSolid: '#D97706',
    textColor: 'text-amber-100',
    icon: <BookOpen className="w-8 h-8 text-amber-200" />,
    illustrationType: 'academic',
  },
  {
    id: 'main_book',
    label: 'মূলবই',
    gradient: 'from-[#6B21A8] via-[#7E22CE] to-[#581C87]',
    bgSolid: '#7E22CE',
    textColor: 'text-purple-100',
    icon: <BookMarked className="w-8 h-8 text-purple-200" />,
    illustrationType: 'main_book',
  },
  {
    id: 'engineering',
    label: 'ইঞ্জিনিয়ারিং',
    gradient: 'from-[#881337] via-[#9F1239] to-[#701A75]',
    bgSolid: '#881337',
    textColor: 'text-rose-100',
    icon: <Calculator className="w-8 h-8 text-rose-200" />,
    illustrationType: 'engineering',
  },
  {
    id: 'medical',
    label: 'মেডিকেল',
    gradient: 'from-[#1E40AF] via-[#2563EB] to-[#1D4ED8]',
    bgSolid: '#2563EB',
    textColor: 'text-blue-100',
    icon: <Stethoscope className="w-8 h-8 text-blue-200" />,
    illustrationType: 'medical',
  },
  {
    id: 'varsity_a',
    label: "ভার্সিটি 'ক'",
    gradient: 'from-[#15803D] via-[#16A34A] to-[#14532D]',
    bgSolid: '#16A34A',
    textColor: 'text-emerald-100',
    icon: <GraduationCap className="w-8 h-8 text-emerald-200" />,
    illustrationType: 'varsity',
  },
];

export const QuestionBankScreen: React.FC<QuestionBankScreenProps> = ({
  questions,
  writtenQuestions: propWrittenQuestions,
  bookmarks,
  onToggleBookmark,
  onAskAI,
  isLoading = false,
}) => {
  // Navigation states
  const [activeTab, setActiveTab] = useState<'subject' | 'model_test' | 'university'>('subject');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSubject, setSelectedSubject] = useState<SubjectInfo | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<ExamCategory | null>(null);
  const [selectedChapter, setSelectedChapter] = useState<Chapter | 'all' | null>(null);
  const [selectedTopicId, setSelectedTopicId] = useState<string | null>(null);
  const [isDrilledIntoTopics, setIsDrilledIntoTopics] = useState<boolean>(false);
  const [isFilterChanging, setIsFilterChanging] = useState<boolean>(false);
  const [questionTypeFilter, setQuestionTypeFilter] = useState<'all' | 'mcq' | 'written'>('mcq');
  const [showAllAnswers, setShowAllAnswers] = useState<boolean>(false);
  const [page, setPage] = useState<number>(1);
  const pageSize = 15;

  const [fetchedWrittenQuestions, setFetchedWrittenQuestions] = useState<WrittenQuestion[]>(INITIAL_WRITTEN_QUESTIONS);

  useEffect(() => {
    fetch('/api/written-questions')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && Array.isArray(data) && data.length > 0) {
          setFetchedWrittenQuestions(data);
        }
      })
      .catch(() => {});
  }, []);

  const allWrittenQuestions = useMemo(() => {
    return propWrittenQuestions && propWrittenQuestions.length > 0
      ? propWrittenQuestions
      : fetchedWrittenQuestions;
  }, [propWrittenQuestions, fetchedWrittenQuestions]);

  // Reset page whenever filter changes
  useEffect(() => {
    setPage(1);
  }, [selectedSubject, selectedCategory, selectedChapter, selectedTopicId, questionTypeFilter, searchQuery]);

  // Filtered Subjects for Level 1
  const filteredSubjects = useMemo(() => {
    if (!searchQuery.trim()) return SUBJECTS_DATA;
    const q = searchQuery.toLowerCase();
    return SUBJECTS_DATA.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.bangla_name.includes(q) ||
        s.paper.includes(q) ||
        (s.short_code && s.short_code.toLowerCase().includes(q))
    );
  }, [searchQuery]);

  // Related chapters for selected subject
  const subjectChapters = useMemo(() => {
    if (!selectedSubject) return [];
    const directChapters = COMPREHENSIVE_CHAPTERS_DATA.filter((c) => c.subject_id === selectedSubject.id);
    if (directChapters.length > 0) return directChapters;

    const fallbackChapters = CHAPTERS_DATA.filter((c) => c.subject_id === selectedSubject.id);
    if (fallbackChapters.length > 0) return fallbackChapters;

    // Fallback: extract distinct chapters from questions
    const extractedMap = new Map<string, Chapter>();
    questions
      .filter((q) => q.subject_id === selectedSubject.id || q.subject_name.includes(selectedSubject.bangla_name))
      .forEach((q) => {
        if (q.chapter_id && !extractedMap.has(q.chapter_id)) {
          extractedMap.set(q.chapter_id, {
            id: q.chapter_id,
            subject_id: selectedSubject.id,
            paper: (selectedSubject.paper.includes('1') ? '1st' : '2nd') as any,
            name: q.chapter_name,
            bangla_name: q.chapter_name,
            total_questions: 50,
            completed_questions: 12,
            star_rating: 3,
          });
        }
      });
    return Array.from(extractedMap.values());
  }, [selectedSubject, questions]);

  // Calculate real category counts for the selected subject
  const categoryCounts = useMemo(() => {
    const counts: Record<ExamCategory, number> = {
      academic: 0,
      main_book: 0,
      engineering: 0,
      medical: 0,
      varsity_a: 0,
    };

    if (!selectedSubject) return counts;

    const subjectQuestions = questions.filter(
      (q) => q.subject_id === selectedSubject.id || q.subject_name.includes(selectedSubject.bangla_name)
    );

    CATEGORY_CARDS_CONFIG.forEach((cat) => {
      const matchCount = subjectQuestions.filter((q) => matchesCategory(q, cat.id)).length;
      counts[cat.id] = matchCount > 0 ? matchCount : Math.max(1, Math.floor((subjectQuestions.length || 5) / 5));
    });

    return counts;
  }, [selectedSubject, questions]);

  // Filtered Questions for Level 4 (Explorer View)
  const currentQuestions = useMemo(() => {
    if (!selectedSubject || !selectedCategory) return [];

    let list = questions.filter(
      (q) => q.subject_id === selectedSubject.id || q.subject_name.includes(selectedSubject.bangla_name)
    );

    // Apply category filter
    const categoryMatched = list.filter((q) => matchesCategory(q, selectedCategory));
    if (categoryMatched.length > 0) {
      list = categoryMatched;
    }

    // Apply chapter filter
    if (selectedChapter && selectedChapter !== 'all') {
      const chapterMatched = list.filter(
        (q) =>
          q.chapter_id === selectedChapter.id ||
          (q.chapter_name && selectedChapter.bangla_name && (
            q.chapter_name.includes(selectedChapter.bangla_name) ||
            selectedChapter.bangla_name.includes(q.chapter_name)
          ))
      );
      list = chapterMatched;

      // Apply topic filter if a specific subtopic is selected
      if (selectedTopicId) {
        const subtopic = selectedChapter.subtopics?.find((st) => st.id === selectedTopicId);
        const subtopicName = subtopic?.bangla_name || '';

        const topicMatched = list.filter(
          (q) =>
            q.topic_id === selectedTopicId ||
            (subtopicName && q.topic_name?.includes(subtopicName)) ||
            (subtopicName && subtopicName.includes(q.topic_name || '')) ||
            (subtopicName && q.tags?.some((t) => t.includes(subtopicName)))
        );
        list = topicMatched;
      }
    }

    // Question type filter
    if (questionTypeFilter !== 'all') {
      list = list.filter((q) => q.type === questionTypeFilter);
    }

    // Search query within questions
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (item) =>
          item.question_text.toLowerCase().includes(q) ||
          item.tags.some((t) => t.toLowerCase().includes(q)) ||
          item.chapter_name.includes(q) ||
          (item.topic_name && item.topic_name.includes(q))
      );
    }

    return list;
  }, [questions, selectedSubject, selectedCategory, selectedChapter, selectedTopicId, questionTypeFilter, searchQuery]);

  // Filtered Written Questions
  const currentWrittenQuestions = useMemo(() => {
    if (!selectedSubject || !selectedCategory) return [];

    let list = allWrittenQuestions.filter(
      (q) => q.subject_id === selectedSubject.id || (q.subject_name && q.subject_name.includes(selectedSubject.bangla_name))
    );

    // Apply category filter
    const categoryMatched = list.filter((q) => matchesCategory(q as any, selectedCategory));
    if (categoryMatched.length > 0) {
      list = categoryMatched;
    }

    // Apply chapter filter
    if (selectedChapter && selectedChapter !== 'all') {
      const chapterMatched = list.filter(
        (q) =>
          q.chapter_id === selectedChapter.id ||
          (q.chapter_name && selectedChapter.bangla_name && (
            q.chapter_name.includes(selectedChapter.bangla_name) ||
            selectedChapter.bangla_name.includes(q.chapter_name)
          ))
      );
      list = chapterMatched;

      if (selectedTopicId) {
        const subtopic = selectedChapter.subtopics?.find((st) => st.id === selectedTopicId);
        const subtopicName = subtopic?.bangla_name || '';

        const topicMatched = list.filter(
          (q) =>
            q.topic_id === selectedTopicId ||
            (subtopicName && q.topic_name?.includes(subtopicName)) ||
            (subtopicName && subtopicName.includes(q.topic_name || '')) ||
            (subtopicName && q.tags?.some((t) => t.includes(subtopicName)))
        );
        list = topicMatched;
      }
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (item) =>
          item.question_text.toLowerCase().includes(q) ||
          item.explanation.toLowerCase().includes(q) ||
          item.tags.some((t) => t.toLowerCase().includes(q)) ||
          item.chapter_name.includes(q) ||
          (item.topic_name && item.topic_name.includes(q))
      );
    }

    return list;
  }, [allWrittenQuestions, selectedSubject, selectedCategory, selectedChapter, selectedTopicId, searchQuery]);

  // Handlers for Chapter & Topic Selection
  const handleSelectChapter = (ch: Chapter) => {
    setSelectedChapter(ch);
    setSelectedTopicId(null);
    setIsDrilledIntoTopics(true);
    setIsFilterChanging(true);
    setTimeout(() => setIsFilterChanging(false), 180);
  };

  const handleSelectAllChapters = () => {
    setSelectedChapter('all');
    setSelectedTopicId(null);
    setIsDrilledIntoTopics(false);
    setIsFilterChanging(true);
    setTimeout(() => setIsFilterChanging(false), 180);
  };

  const handleBackToChapters = () => {
    setIsDrilledIntoTopics(false);
  };

  const handleSelectTopic = (topicId: string | null) => {
    setSelectedTopicId(topicId);
    setIsFilterChanging(true);
    setTimeout(() => setIsFilterChanging(false), 180);
  };

  // Render subject icon helper
  const renderSubjectArt = (sub: SubjectInfo) => {
    if (sub.id.startsWith('physics')) return <Atom className="w-12 h-12 text-white/20" />;
    if (sub.id.startsWith('chem')) return <FlaskConical className="w-12 h-12 text-white/20" />;
    if (sub.id.startsWith('math')) return <Calculator className="w-12 h-12 text-white/20" />;
    if (sub.id.startsWith('bio')) return <Dna className="w-12 h-12 text-white/20" />;
    if (sub.id === 'ict') return <Laptop className="w-12 h-12 text-white/20" />;
    if (sub.id === 'bangla') return <BookOpen className="w-12 h-12 text-white/20" />;
    if (sub.id === 'english') return <Languages className="w-12 h-12 text-white/20" />;
    return <Globe2 className="w-12 h-12 text-white/20" />;
  };

  // ==========================================
  // LEVEL 3 & 4: Questions List with Sticky Hierarchical Chapter/Topic Bar (Matching Video)
  // ==========================================
  if (selectedSubject && selectedCategory) {
    const activeCategoryInfo = CATEGORY_CARDS_CONFIG.find((c) => c.id === selectedCategory);
    const activeCategoryLabel = activeCategoryInfo ? activeCategoryInfo.label : selectedCategory;

    const isWrittenMode = questionTypeFilter === 'written';
    const activeList = isWrittenMode ? currentWrittenQuestions : currentQuestions;

    const totalPages = Math.ceil(activeList.length / pageSize) || 1;
    const safePage = Math.min(Math.max(1, page), totalPages);
    const startIndex = (safePage - 1) * pageSize;
    const endIndex = Math.min(startIndex + pageSize, activeList.length);
    const paginatedItems = activeList.slice(startIndex, endIndex);

    const handlePageChange = (newPage: number) => {
      if (newPage < 1 || newPage > totalPages) return;
      setPage(newPage);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    return (
      <div className="space-y-4 pb-36 max-w-2xl mx-auto px-1 sm:px-2">
        {/* Top Header (Matching Screenshots 1-4) */}
        <div className="pt-2 pb-1 flex items-center justify-between border-b border-slate-200/80 dark:border-slate-750">
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => {
                setSelectedChapter(null);
                setSelectedTopicId(null);
                setIsDrilledIntoTopics(false);
                setSelectedCategory(null);
              }}
              className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
              title="ক্যাটাগরি নির্বাচনে ফিরে যান"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h2 className="font-bold text-slate-900 dark:text-slate-100 text-base sm:text-lg tracking-tight">
              {selectedSubject.bangla_name} {selectedSubject.paper} ({activeCategoryLabel})
            </h2>
          </div>

          <div className="flex items-center gap-2">
            {/* Universal Eye Toggle Button */}
            <button
              type="button"
              id="btn-toggle-all-answers"
              onClick={() => setShowAllAnswers((prev) => !prev)}
              className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-2xs ${
                showAllAnswers
                  ? 'bg-[#047857] text-white ring-2 ring-emerald-400'
                  : 'bg-[#059669] hover:bg-[#047857] text-white'
              }`}
              title={showAllAnswers ? 'সকল উত্তর লুকান' : 'একসাথে সকল উত্তর দেখুন'}
            >
              {showAllAnswers ? (
                <>
                  <EyeOff className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  <span className="hidden sm:inline">উত্তর লুকান</span>
                </>
              ) : (
                <>
                  <Eye className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  <span className="hidden sm:inline">সকল উত্তর</span>
                </>
              )}
            </button>

            <span className="px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold font-mono border border-slate-200/60 dark:border-slate-700">
              {toBengaliNumber(activeList.length)} টি প্রশ্ন
            </span>
          </div>
        </div>

        {/* Range Indicator */}
        {activeList.length > 0 && totalPages > 1 && (
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-medium px-1">
            <span>
              দেখানো হচ্ছে: <strong className="text-slate-800 dark:text-slate-200 font-mono">{toBengaliNumber(startIndex + 1)} - {toBengaliNumber(endIndex)}</strong>
            </span>
            <span>
              পৃষ্ঠা: <strong className="text-slate-800 dark:text-slate-200 font-mono">{toBengaliNumber(safePage)} / {toBengaliNumber(totalPages)}</strong>
            </span>
          </div>
        )}

        {/* Questions List with Quick Shimmer Animation during Filter Transitions */}
        {isLoading || isFilterChanging ? (
          <div className="space-y-3 pt-1" id="question-bank-skeleton-loading">
            <QuestionListSkeleton count={4} />
          </div>
        ) : paginatedItems.length > 0 ? (
          <div className="space-y-3 pt-1">
            {isWrittenMode ? (
              (paginatedItems as WrittenQuestion[]).map((wq, idx) => (
                <WrittenQuestionCard
                  key={wq.id}
                  question={wq}
                  index={startIndex + idx}
                  forceShowAnswer={showAllAnswers}
                  isBookmarked={bookmarks.includes(wq.id)}
                  onToggleBookmark={() => onToggleBookmark(wq.id)}
                  onAskAI={onAskAI as any}
                />
              ))
            ) : (
              (paginatedItems as Question[]).map((q, idx) => (
                <QuestionCard
                  key={q.id}
                  question={q}
                  index={startIndex + idx}
                  mode="practice"
                  forceShowAnswer={showAllAnswers}
                  isBookmarked={bookmarks.includes(q.id)}
                  onToggleBookmark={() => onToggleBookmark(q.id)}
                  onAskAI={onAskAI}
                />
              ))
            )}

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="pt-3 pb-4 flex flex-col sm:flex-row items-center justify-between gap-3 bg-white dark:bg-slate-800 p-3 rounded-2xl border border-slate-200/80 dark:border-slate-700 shadow-2xs">
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => handlePageChange(safePage - 1)}
                    disabled={safePage <= 1}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    <span>পূর্ববর্তী</span>
                  </button>

                  {/* Page numbers */}
                  <div className="flex items-center gap-1">
                    {Array.from({ length: totalPages }, (_, i) => i + 1)
                      .filter((pNum) => pNum === 1 || pNum === totalPages || Math.abs(pNum - safePage) <= 1)
                      .map((pNum, idx, arr) => {
                        const showEllipsisBefore = idx > 0 && pNum - arr[idx - 1] > 1;
                        return (
                          <React.Fragment key={pNum}>
                            {showEllipsisBefore && (
                              <span className="px-1 text-slate-400 text-xs">...</span>
                            )}
                            <button
                              type="button"
                              onClick={() => handlePageChange(pNum)}
                              className={`w-8 h-8 rounded-xl text-xs font-bold font-mono transition-colors cursor-pointer flex items-center justify-center ${
                                safePage === pNum
                                  ? 'bg-[#1E3A8A] dark:bg-blue-600 text-white shadow-2xs'
                                  : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200/60 dark:border-slate-700'
                              }`}
                            >
                              {toBengaliNumber(pNum)}
                            </button>
                          </React.Fragment>
                        );
                      })}
                  </div>

                  <button
                    type="button"
                    onClick={() => handlePageChange(safePage + 1)}
                    disabled={safePage >= totalPages}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                  >
                    <span>পরবর্তী</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>

                <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                  মোট <span className="font-bold text-slate-800 dark:text-slate-200 font-mono">{toBengaliNumber(currentQuestions.length)}</span> টি প্রশ্ন
                </div>
              </div>
            )}
          </div>
        ) : (
          <EmptyState
            title="এই ফিল্টারে কোনো প্রশ্ন পাওয়া যায়নি"
            description="নিচের বার থেকে অন্য অধ্যায় বা টপিক নির্বাচন করুন অথবা ফিল্টার রিসেট করুন।"
            actionLabel="সকল অধ্যায় দেখুন"
            onAction={handleSelectAllChapters}
          />
        )}

        {/* Sticky Bottom Bar: Horizontal Scrollable Chapter/Topic Chips + MCQ/Written Toggle (Matching Video) */}
        <div className="fixed bottom-[56px] left-0 right-0 z-30 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200/90 dark:border-slate-800 py-2.5 px-3 max-w-2xl mx-auto shadow-lg space-y-2">
          {/* Row 1: Horizontal Scrollable Chapter / Topic Chips */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar text-xs">
            {!isDrilledIntoTopics || selectedChapter === 'all' || !selectedChapter ? (
              <>
                {/* All Chapters Chip */}
                <button
                  type="button"
                  id="btn-all-chapters"
                  onClick={handleSelectAllChapters}
                  className={`px-3.5 py-1.5 rounded-full border text-xs font-bold whitespace-nowrap transition-all cursor-pointer shrink-0 ${
                    selectedChapter === 'all' || selectedChapter === null
                      ? 'bg-slate-900 dark:bg-emerald-500 text-white dark:text-slate-950 border-slate-900 dark:border-emerald-500 shadow-xs'
                      : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'
                  }`}
                >
                  সকল অধ্যায়
                </button>

                {/* Individual Chapter Chips */}
                {subjectChapters.map((ch) => {
                  const isSelected = selectedChapter !== 'all' && selectedChapter?.id === ch.id;
                  const count = ch.total_questions || 50;

                  return (
                    <button
                      type="button"
                      key={ch.id}
                      id={`btn-chapter-${ch.id}`}
                      onClick={() => handleSelectChapter(ch)}
                      className={`px-3.5 py-1.5 rounded-full border text-xs font-bold whitespace-nowrap transition-all cursor-pointer shrink-0 ${
                        isSelected
                          ? 'bg-slate-900 dark:bg-emerald-500 text-white dark:text-slate-950 border-slate-900 dark:border-emerald-500 shadow-xs'
                          : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'
                      }`}
                    >
                      {ch.bangla_name} ({toBengaliNumber(count)})
                    </button>
                  );
                })}
              </>
            ) : (
              <>
                {/* Back to Chapters List button */}
                <button
                  type="button"
                  id="btn-back-to-chapters"
                  onClick={handleBackToChapters}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700 text-xs font-bold whitespace-nowrap transition-all cursor-pointer shrink-0"
                  title="অধ্যায়সমূহে ফিরে যান"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>অধ্যায়সমূহ</span>
                </button>

                {/* All Topics Chip for the Selected Chapter */}
                <button
                  type="button"
                  id="btn-all-topics"
                  onClick={() => handleSelectTopic(null)}
                  className={`px-3.5 py-1.5 rounded-full border text-xs font-bold whitespace-nowrap transition-all cursor-pointer shrink-0 ${
                    selectedTopicId === null
                      ? 'bg-slate-900 dark:bg-emerald-500 text-white dark:text-slate-950 border-slate-900 dark:border-emerald-500 shadow-xs'
                      : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'
                  }`}
                >
                  সকল টপিক ({toBengaliNumber(selectedChapter.total_questions || 50)})
                </button>

                {/* Subtopic Chips for Selected Chapter */}
                {(selectedChapter.subtopics || []).map((st) => {
                  const isSelected = selectedTopicId === st.id;
                  const count = st.total_questions || 20;

                  return (
                    <button
                      type="button"
                      key={st.id}
                      id={`btn-topic-${st.id}`}
                      onClick={() => handleSelectTopic(st.id)}
                      className={`px-3.5 py-1.5 rounded-full border text-xs font-bold whitespace-nowrap transition-all cursor-pointer shrink-0 ${
                        isSelected
                          ? 'bg-slate-900 dark:bg-emerald-500 text-white dark:text-slate-950 border-slate-900 dark:border-emerald-500 shadow-xs'
                          : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'
                      }`}
                    >
                      {st.bangla_name} ({toBengaliNumber(count)})
                    </button>
                  );
                })}
              </>
            )}
          </div>

          {/* Row 2: MCQ vs Written Filter Radio/Pills (Matching Video & Screenshot 4) */}
          <div className="flex items-center gap-5 px-1 pt-0.5">
            <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer select-none">
              <input
                type="radio"
                name="qtype_bottom"
                checked={questionTypeFilter === 'mcq'}
                onChange={() => setQuestionTypeFilter('mcq')}
                className="text-[#2563EB] focus:ring-[#2563EB] cursor-pointer"
              />
              <span>MCQ</span>
            </label>
            <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer select-none">
              <input
                type="radio"
                name="qtype_bottom"
                checked={questionTypeFilter === 'written'}
                onChange={() => setQuestionTypeFilter('written')}
                className="text-[#2563EB] focus:ring-[#2563EB] cursor-pointer"
              />
              <span>Written</span>
            </label>
          </div>
        </div>
      </div>
    );
  }

  // ==========================================
  // LEVEL 2: ExamCategory Grid for Selected Subject
  // ==========================================
  if (selectedSubject) {
    return (
      <div className="space-y-4 pb-20 max-w-2xl mx-auto px-1 sm:px-2">
        {/* Header with Back button (Matching Screenshot 2) */}
        <div className="flex items-center gap-3 py-1 px-1">
          <button
            onClick={() => setSelectedSubject(null)}
            className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
            title="বিষয় নির্বাচনে ফিরে যান"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h2 className="font-bold text-slate-900 dark:text-slate-100 text-lg sm:text-xl tracking-tight">
            {selectedSubject.bangla_name} {selectedSubject.paper}
          </h2>
        </div>

        {/* 5 ExamCategory Cards Grid (Matching Screenshot 2) */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {CATEGORY_CARDS_CONFIG.map((cat) => {
            const count = categoryCounts[cat.id] || 1;

            return (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`relative overflow-hidden rounded-2xl p-4 sm:p-5 text-white flex flex-col justify-between h-40 sm:h-44 shadow-sm hover:shadow-md transition-all text-left cursor-pointer active:scale-95 group border border-black/10 bg-gradient-to-br ${cat.gradient}`}
              >
                {/* Top Category Label */}
                <div>
                  <h3 className="font-bold text-base sm:text-lg tracking-tight leading-snug drop-shadow-xs">
                    {cat.label}
                  </h3>
                </div>

                {/* Center / Background Thematic Illustration */}
                <div className="absolute right-2 bottom-2 opacity-30 group-hover:opacity-40 group-hover:scale-110 transition-all pointer-events-none">
                  {cat.icon}
                </div>

                {/* Bottom Pencil Count Badge */}
                <div className="relative z-10">
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-white/95 dark:bg-slate-900/90 text-slate-800 dark:text-slate-100 text-xs font-bold font-mono shadow-2xs">
                    <Pencil className="w-3 h-3 text-slate-600 dark:text-slate-400 stroke-[2.5]" />
                    <span>{count}</span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // ==========================================
  // LEVEL 1: Question Bank Home (Matching Screenshot 1)
  // ==========================================
  return (
    <div className="space-y-4 pb-20 max-w-2xl mx-auto px-1 sm:px-2">
      {/* 1. Search Bar */}
      <div className="relative">
        <input
          type="text"
          id="input-search-questionbank"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="প্রশ্নব্যাংক খুঁজুন..."
          className="w-full pl-10 pr-9 py-2.5 sm:py-3 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/90 dark:border-slate-700 text-sm text-slate-900 dark:text-slate-100 focus:outline-hidden focus:border-[#2563EB] focus:ring-2 focus:ring-blue-100 shadow-2xs placeholder:text-slate-400 dark:placeholder:text-slate-500"
        />
        <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5 sm:top-4" />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 absolute right-3 top-2.5 sm:top-3 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* 2. Top Segmented Tabs: মডেল টেস্ট / বিষয় ভিত্তিক / প্রতিষ্ঠান ভিত্তিক */}
      <div className="flex items-center justify-between gap-1.5 p-1 rounded-2xl bg-slate-100/80 dark:bg-slate-800/80 border border-slate-200/60 dark:border-slate-700">
        <button
          onClick={() => setActiveTab('model_test')}
          className={`flex-1 py-2 px-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer text-center ${
            activeTab === 'model_test'
              ? 'bg-[#1E3A8A] text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
          }`}
        >
          মডেল টেস্ট
        </button>

        <button
          onClick={() => setActiveTab('subject')}
          className={`flex-1 py-2 px-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer text-center ${
            activeTab === 'subject'
              ? 'bg-[#15803D] text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
          }`}
        >
          বিষয় ভিত্তিক
        </button>

        <button
          onClick={() => setActiveTab('university')}
          className={`flex-1 py-2 px-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer text-center ${
            activeTab === 'university'
              ? 'bg-[#1E3A8A] text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
          }`}
        >
          প্রতিষ্ঠান ভিত্তিক
        </button>
      </div>

      {/* 3. Tab Content: বিষয় ভিত্তিক (Subject Cards Grid) */}
      {activeTab === 'subject' && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 sm:gap-3">
          {filteredSubjects.map((sub) => {
            const count = sub.totalQuestions || 150;

            return (
              <button
                key={sub.id}
                onClick={() => setSelectedSubject(sub)}
                className={`relative overflow-hidden rounded-2xl p-4 sm:p-5 text-white flex flex-col justify-between h-40 sm:h-44 shadow-sm hover:shadow-md transition-all text-left cursor-pointer active:scale-95 group border border-black/10 bg-gradient-to-br ${sub.gradient}`}
              >
                {/* Top Subject Title */}
                <div>
                  <h3 className="font-bold text-base sm:text-lg tracking-tight leading-snug drop-shadow-xs">
                    {sub.bangla_name}
                  </h3>
                  <span className="text-xs text-white/80 font-medium block mt-0.5">
                    {sub.paper}
                  </span>
                </div>

                {/* Center / Background Art Icon */}
                <div className="absolute right-2 bottom-2 opacity-30 group-hover:opacity-40 group-hover:scale-110 transition-all pointer-events-none">
                  {renderSubjectArt(sub)}
                </div>

                {/* Bottom Pencil Count Badge */}
                <div className="relative z-10">
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-white/95 dark:bg-slate-900/90 text-slate-800 dark:text-slate-100 text-xs font-bold font-mono shadow-2xs">
                    <Pencil className="w-3 h-3 text-slate-600 dark:text-slate-400 stroke-[2.5]" />
                    <span>{count}</span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Tab Content: প্রতিষ্ঠান ভিত্তিক (University Wise) */}
      {activeTab === 'university' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {UNIVERSITIES_DATA.map((uni) => (
            <div
              key={uni.id}
              className="bg-white dark:bg-slate-800 p-3.5 rounded-2xl border border-slate-200/80 dark:border-slate-700 shadow-xs flex items-center justify-between hover:border-[#2563EB] transition-all"
            >
              <div className="flex items-center gap-2.5">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-xs shadow-xs"
                  style={{ backgroundColor: uni.bgColor }}
                >
                  {uni.shortCode.split(' ')[0]}
                </div>
                <div>
                  <h4 className="font-bold text-[#1E3A8A] dark:text-blue-400 text-sm leading-tight">{uni.name}</h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate max-w-[180px]">{uni.fullName}</p>
                </div>
              </div>

              <button
                onClick={() => {
                  setSelectedSubject(SUBJECTS_DATA[0]);
                  setSelectedCategory('varsity_a');
                }}
                className="px-3 py-1.5 bg-[#2563EB] hover:bg-blue-600 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer shadow-2xs"
              >
                প্রশ্ন দেখুন
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Tab Content: মডেল টেস্ট (Model Tests) */}
      {activeTab === 'model_test' && (
        <div className="space-y-2.5">
          <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-700 shadow-xs flex items-center justify-between">
            <div>
              <div className="inline-block px-2 py-0.5 bg-blue-50 dark:bg-blue-950/60 text-[#1E40AF] dark:text-blue-300 text-[10px] font-bold uppercase rounded-md mb-1 border border-blue-200 dark:border-blue-800">
                Live Model Test
              </div>
              <h4 className="font-bold text-slate-900 dark:text-slate-100 text-sm sm:text-base">
                ঢাকা বিশ্ববিদ্যালয় 'ক' ইউনিট পূর্ণাঙ্গ মডেল টেস্ট - ০১
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-mono">১০০ টি প্রশ্ন • ৯০ মিনিট</p>
            </div>
            <button
              onClick={() => {
                setSelectedSubject(SUBJECTS_DATA[0]);
                setSelectedCategory('varsity_a');
              }}
              className="px-3.5 py-1.5 bg-[#2563EB] hover:bg-blue-600 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer"
            >
              অংশগ্রহণ
            </button>
          </div>

          <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-700 shadow-xs flex items-center justify-between">
            <div>
              <div className="inline-block px-2 py-0.5 bg-purple-50 dark:bg-purple-950/60 text-purple-800 dark:text-purple-300 text-[10px] font-bold uppercase rounded-md mb-1 border border-purple-200 dark:border-purple-800">
                BUET Engineering
              </div>
              <h4 className="font-bold text-slate-900 dark:text-slate-100 text-sm sm:text-base">
                BUET প্রিলিমিনারি ফিজিক্স & ম্যাথ স্পিড টেস্ট
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-mono">৫০ টি প্রশ্ন • ৪৫ মিনিট</p>
            </div>
            <button
              onClick={() => {
                setSelectedSubject(SUBJECTS_DATA[0]);
                setSelectedCategory('engineering');
              }}
              className="px-3.5 py-1.5 bg-[#2563EB] hover:bg-blue-600 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer"
            >
              অংশগ্রহণ
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default QuestionBankScreen;

