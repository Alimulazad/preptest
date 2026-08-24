import React, { useState, useMemo, useRef } from 'react';
import {
  Upload,
  FileSpreadsheet,
  FileText,
  FileJson,
  Download,
  CheckCircle2,
  AlertCircle,
  X,
  Sparkles,
  HelpCircle,
  Trash2,
  Eye,
  RefreshCw,
  Sliders,
  Database,
  ArrowRight,
  Info,
  Check
} from 'lucide-react';
import { QuestionSubject } from '../../types';
import { SUBJECTS_DATA, CHAPTERS_DATA } from '../../data/admissionData';
import MathText from '../MathText';
import {
  ParsedQuestionItem,
  BulkDefaults,
  parseExcelOrCsvFile,
  parseRawBengaliQuestions,
  downloadExcelTemplate,
  downloadCsvTemplate,
  downloadJsonTemplate,
} from '../../utils/bulkQuestionParser';
import { validateStrictJsonFormat } from '../../utils/jsonValidator';
import { bulkImportQuestionsApi } from '../../services/api';

interface AdminBulkImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (count: number) => void;
}

export const AdminBulkImportModal: React.FC<AdminBulkImportModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [activeTab, setActiveTab] = useState<'file' | 'text' | 'templates'>('file');
  
  // Defaults configuration
  const [defaultSubject, setDefaultSubject] = useState<QuestionSubject>('physics_1');
  const [defaultChapter, setDefaultChapter] = useState<string>('phy1_ch1');
  const [defaultDifficulty, setDefaultDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium');
  const [defaultTagsInput, setDefaultTagsInput] = useState<string>('DU Ka 24-25, Varsity A');

  // File Upload State
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [isProcessingFile, setIsProcessingFile] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Raw Text State
  const [rawBengaliTextInput, setRawBengaliTextInput] = useState<string>('');

  // Parsed Questions Pre-flight State
  const [parsedQuestions, setParsedQuestions] = useState<ParsedQuestionItem[]>([]);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [previewFilter, setPreviewFilter] = useState<'all' | 'valid' | 'invalid'>('all');

  // Available chapters for selected default subject
  const availableChapters = useMemo(() => {
    return CHAPTERS_DATA.filter((ch) => ch.subject_id === defaultSubject);
  }, [defaultSubject]);

  const handleSubjectChange = (subjectId: QuestionSubject) => {
    setDefaultSubject(subjectId);
    const firstChap = CHAPTERS_DATA.find((ch) => ch.subject_id === subjectId);
    if (firstChap) {
      setDefaultChapter(firstChap.id);
    }
  };

  const getBulkDefaults = (): BulkDefaults => {
    const selectedChapObj = CHAPTERS_DATA.find((c) => c.id === defaultChapter);
    const selectedSubObj = SUBJECTS_DATA.find((s) => s.id === defaultSubject);
    const tagsArr = defaultTagsInput.split(/[,;]+/).map((t) => t.trim()).filter(Boolean);

    return {
      subject_id: defaultSubject,
      subject_name: selectedSubObj?.name || 'Physics 1st Paper',
      paper: defaultSubject.endsWith('_2') ? '2nd' : '1st',
      chapter_id: defaultChapter,
      chapter_name: selectedChapObj?.name || 'সাধারণ অধ্যায়',
      tags: tagsArr.length > 0 ? tagsArr : ['Varsity Ka'],
      difficulty: defaultDifficulty,
    };
  };

  // 1. Handle File Selection (Excel .xlsx, .xls, .csv, or .json)
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadedFileName(file.name);
    setIsProcessingFile(true);
    setParseErrors([]);
    setSubmitError(null);

    const defaults = getBulkDefaults();

    try {
      const fileNameLower = file.name.toLowerCase();
      if (fileNameLower.endsWith('.json')) {
        // Handle JSON file
        const text = await file.text();
        const jsonValidation = validateStrictJsonFormat(text);
        if (!jsonValidation.valid) {
          setParseErrors(jsonValidation.errors.map((e) => `${e.path}: ${e.message}`));
          setIsProcessingFile(false);
          return;
        }

        let rawList: any[] = [];
        const parsed = jsonValidation.parsedData;
        if (Array.isArray(parsed)) {
          rawList = parsed;
        } else if (parsed && Array.isArray(parsed.questions)) {
          rawList = parsed.questions;
        } else if (parsed && Array.isArray(parsed.data)) {
          rawList = parsed.data;
        }

        const enriched: ParsedQuestionItem[] = rawList.map((item, idx) => {
          const opts = item.options || {};
          let optA = typeof opts === 'object' && !Array.isArray(opts) ? (opts.A || opts.a || opts['ক'] || '') : '';
          let optB = typeof opts === 'object' && !Array.isArray(opts) ? (opts.B || opts.b || opts['খ'] || '') : '';
          let optC = typeof opts === 'object' && !Array.isArray(opts) ? (opts.C || opts.c || opts['গ'] || '') : '';
          let optD = typeof opts === 'object' && !Array.isArray(opts) ? (opts.D || opts.d || opts['ঘ'] || '') : '';

          if (Array.isArray(opts) && opts.length >= 4) {
            optA = opts[0]?.text || '';
            optB = opts[1]?.text || '';
            optC = opts[2]?.text || '';
            optD = opts[3]?.text || '';
          }

          const qText = item.question_text || item.questionText || item.question || '';
          const correctAns = item.correct_ans || item.correctAnswer || item.ans || 'A';
          const expl = item.explanation || item.solution || '';

          const issues: string[] = [];
          if (!qText.trim()) issues.push('প্রশ্নের বিবরণ অনুপস্থিত');
          if (!optA.trim()) issues.push('অপশন A অনুপস্থিত');
          if (!optB.trim()) issues.push('অপশন B অনুপস্থিত');
          if (!optC.trim()) issues.push('অপশন C অনুপস্থিত');
          if (!optD.trim()) issues.push('অপশন D অনুপস্থিত');

          return {
            id: item.id || `q_json_${idx}_${Date.now()}`,
            question_text: qText,
            options: { A: optA, B: optB, C: optC, D: optD },
            correct_ans: (correctAns.toUpperCase() as any) || 'A',
            explanation: expl,
            subject_id: item.subject_id || defaults.subject_id,
            subject_name: item.subject_name || defaults.subject_name,
            paper: item.paper || defaults.paper,
            chapter_id: item.chapter_id || defaults.chapter_id,
            chapter_name: item.chapter_name || defaults.chapter_name,
            tags: Array.isArray(item.tags) ? item.tags : defaults.tags,
            difficulty: item.difficulty || defaults.difficulty,
            star_rating: item.star_rating || 3,
            type: item.type || 'mcq',
            isValid: issues.length === 0,
            validationIssues: issues,
            rawSourceIndex: idx + 1,
          };
        });

        setParsedQuestions(enriched);
      } else {
        // Handle Excel (.xlsx, .xls) or CSV
        const result = await parseExcelOrCsvFile(file, defaults);
        if (!result.success && result.errors.length > 0) {
          setParseErrors(result.errors);
        } else {
          setParsedQuestions(result.questions);
        }
      }
    } catch (err: any) {
      setParseErrors([`ফাইল পড়তে ত্রুটি: ${err.message || 'অজানা সমস্যা'}`]);
    } finally {
      setIsProcessingFile(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // 2. Handle Bengali Raw Text Parsing
  const handleParseRawText = () => {
    if (!rawBengaliTextInput.trim()) {
      setParseErrors(['অনুগ্রহ করে টেক্সট বক্সে প্রশ্নাবলী পেস্ট করুন।']);
      return;
    }

    setParseErrors([]);
    setSubmitError(null);
    const defaults = getBulkDefaults();
    const result = parseRawBengaliQuestions(rawBengaliTextInput, defaults);

    if (!result.success || result.questions.length === 0) {
      setParseErrors(result.errors.length ? result.errors : ['কোনো প্রশ্ন শনাক্ত করা যায়নি। সঠিক ফরম্যাটে প্রশ্ন দিন।']);
    } else {
      setParsedQuestions(result.questions);
    }
  };

  const handleLoadSampleBengaliText = () => {
    const sample = `১. একটি প্রক্ষেপকের সর্বাধিক পাল্লা R_max এবং সর্বাধিক উচ্চতা H এর মধ্যে সম্পর্ক কোনটি?
(ক) R_max = 4H
(খ) R_max = 2H
(গ) R_max = H/4
(ঘ) R_max = H/2
উত্তর: ক
ব্যাখ্যা: সর্বাধিক পাল্লা $R_{max} = \\frac{v_0^2}{g}$ এবং উচ্চতা $H = \\frac{v_0^2}{4g}$। অতএব, $R_{max} = 4H$।

২. নিচের কোনটিতে সবচেয়ে শক্তিশালী হাইড্রোজেন বন্ধন বিদ্যমান?
(ক) H2O
(খ) HF
(গ) NH3
(ঘ) CH3OH
উ: খ
ব্যাখ্যা: ফ্লোরিনের উচ্চ তড়িৎ-ঋণাত্মকতার কারণে HF-এ সবচেয়ে শক্তিশালী হাইড্রোজেন বন্ধন থাকে।

৩. lim_{x->0} (sin 5x) / ln(1 + 2x) এর মান কত?
(A) 5/2
(B) 2/5
(C) 5
(D) 0
Ans: A
ব্যাখ্যা: L'Hospital নিয়ম ব্যবহার করে মান পাওয়া যায় 5/2।`;

    setRawBengaliTextInput(sample);
  };

  // Delete a single item from the pre-flight list
  const handleDeleteParsedItem = (index: number) => {
    setParsedQuestions((prev) => prev.filter((_, idx) => idx !== index));
  };

  // Apply default subject/chapter across all currently parsed items
  const handleApplyDefaultsToAll = () => {
    const defaults = getBulkDefaults();
    setParsedQuestions((prev) =>
      prev.map((q) => ({
        ...q,
        subject_id: defaults.subject_id,
        subject_name: defaults.subject_name,
        paper: defaults.paper,
        chapter_id: defaults.chapter_id,
        chapter_name: defaults.chapter_name,
        tags: defaults.tags,
        difficulty: defaults.difficulty,
      }))
    );
  };

  // Filtered preview items
  const filteredPreview = useMemo(() => {
    if (previewFilter === 'valid') return parsedQuestions.filter((q) => q.isValid);
    if (previewFilter === 'invalid') return parsedQuestions.filter((q) => !q.isValid);
    return parsedQuestions;
  }, [parsedQuestions, previewFilter]);

  const validCount = parsedQuestions.filter((q) => q.isValid).length;
  const invalidCount = parsedQuestions.length - validCount;

  // 3. Final Submit to Backend Database
  const handleFinalSubmit = async () => {
    if (parsedQuestions.length === 0) return;

    // Filter out completely invalid questions or notify
    const questionsToUpload = parsedQuestions.filter((q) => q.isValid);

    if (questionsToUpload.length === 0) {
      setSubmitError('কোনো ভ্যালিড প্রশ্ন পাওয়া যায়নি। অনুগ্রহ করে লাল চিহ্নিত ত্রুটিযুক্ত প্রশ্নগুলো সংশোধন বা ডিলিট করুন।');
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      // Format questions for backend bulk import schema
      const formatted = questionsToUpload.map((q) => ({
        subject_id: q.subject_id,
        subject_name: q.subject_name,
        paper: q.paper,
        chapter_id: q.chapter_id,
        chapter_name: q.chapter_name,
        topic_id: q.topic_id,
        topic_name: q.topic_name,
        category: q.category || 'varsity_a',
        question_text: q.question_text,
        options: q.options,
        correct_ans: q.correct_ans,
        explanation: q.explanation || '',
        tags: q.tags || [],
        difficulty: q.difficulty || 'medium',
        star_rating: q.star_rating || 3,
        type: q.type || 'mcq',
      }));

      const res = await bulkImportQuestionsApi(formatted);
      onSuccess(res.count);
      onClose();
    } catch (err: any) {
      setSubmitError(err.message || 'ডেটাবেজে প্রশ্ন সংরক্ষণ ব্যর্থ হয়েছে।');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-3 md:p-6 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-5xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 my-auto">
        
        {/* Top Header */}
        <div className="p-5 md:p-6 bg-gradient-to-r from-indigo-900 via-slate-900 to-indigo-950 text-white flex items-center justify-between border-b border-indigo-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-300 shadow-inner">
              <Upload className="w-5 h-5" />
            </div>
            <div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-bold uppercase tracking-wider mb-1 border border-emerald-400/30">
                <Sparkles className="w-3 h-3" />
                Bulk Question Importer 2.0
              </div>
              <h2 className="text-lg md:text-xl font-bold tracking-tight">স্মার্ট বাল্ক প্রশ্ন ইমপোর্টার</h2>
              <p className="text-xs text-indigo-200/80">
                Excel (.xlsx), CSV, JSON ফাইল আপলোড করুন অথবা মাইক্রোসফট ওয়ার্ড / টেক্সট থেকে সরাসরি প্রশ্ন পেস্ট করুন
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-indigo-200 hover:text-white hover:bg-white/10 rounded-xl transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Global Settings & Defaults Bar */}
        <div className="bg-slate-50 border-b border-slate-200 p-4 shrink-0">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
              <Sliders className="w-3.5 h-3.5 text-indigo-600" />
              <span>গ্লোবাল মেটাডাটা ও ডিফল্ট সেটিংস (যদি ফাইলে বিষয়/অধ্যায় উল্লেখ না থাকে):</span>
            </div>
            {parsedQuestions.length > 0 && (
              <button
                type="button"
                onClick={handleApplyDefaultsToAll}
                className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 cursor-pointer"
              >
                <RefreshCw className="w-3 h-3" />
                সকল প্রিভিউ প্রশ্নে প্রয়োগ করুন
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
            {/* Subject */}
            <div>
              <label className="block font-semibold text-slate-600 mb-1">বিষয় (Subject)</label>
              <select
                value={defaultSubject}
                onChange={(e) => handleSubjectChange(e.target.value as QuestionSubject)}
                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-800 font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
              >
                {SUBJECTS_DATA.map((sub) => (
                  <option key={sub.id} value={sub.id}>
                    {sub.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Chapter */}
            <div>
              <label className="block font-semibold text-slate-600 mb-1">অধ্যায় (Chapter)</label>
              <select
                value={defaultChapter}
                onChange={(e) => setDefaultChapter(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-800 font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
              >
                {availableChapters.map((chap) => (
                  <option key={chap.id} value={chap.id}>
                    {chap.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Tags */}
            <div>
              <label className="block font-semibold text-slate-600 mb-1">ডিফল্ট ট্যাগ (Tags)</label>
              <input
                type="text"
                value={defaultTagsInput}
                onChange={(e) => setDefaultTagsInput(e.target.value)}
                placeholder="যেমন: DU Ka 24-25, Model Test"
                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-800 font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
              />
            </div>

            {/* Difficulty */}
            <div>
              <label className="block font-semibold text-slate-600 mb-1">ডিফিকাল্টি লেভেল</label>
              <select
                value={defaultDifficulty}
                onChange={(e) => setDefaultDifficulty(e.target.value as any)}
                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-800 font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
              >
                <option value="easy">Easy (সহজ)</option>
                <option value="medium">Medium (মাঝারি)</option>
                <option value="hard">Hard (কঠিন)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Input Methods Tab Switcher */}
        <div className="px-6 pt-4 bg-white border-b border-slate-200 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('file')}
              className={`px-4 py-2.5 rounded-t-xl text-xs font-bold flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
                activeTab === 'file'
                  ? 'border-indigo-600 text-indigo-600 bg-indigo-50/50'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>১. ফাইল আপলোড (Excel / CSV / JSON)</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('text')}
              className={`px-4 py-2.5 rounded-t-xl text-xs font-bold flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
                activeTab === 'text'
                  ? 'border-indigo-600 text-indigo-600 bg-indigo-50/50'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <FileText className="w-4 h-4" />
              <span>২. টেক্সট পেস্ট (Raw Bengali Text Parser)</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('templates')}
              className={`px-4 py-2.5 rounded-t-xl text-xs font-bold flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
                activeTab === 'templates'
                  ? 'border-indigo-600 text-indigo-600 bg-indigo-50/50'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Download className="w-4 h-4 text-emerald-600" />
              <span>৩. রেডিমেড টেমপ্লেট ডাউনলোড</span>
            </button>
          </div>

          <div className="text-[11px] font-semibold text-slate-500 hidden md:block">
            সাপোর্ট: <code className="bg-slate-100 px-1.5 py-0.5 rounded text-indigo-700">.xlsx</code> <code className="bg-slate-100 px-1.5 py-0.5 rounded text-indigo-700">.csv</code> <code className="bg-slate-100 px-1.5 py-0.5 rounded text-indigo-700">.json</code> & বাংলা টেক্সট
          </div>
        </div>

        {/* Tab Body Contents */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          
          {/* TAB 1: FILE UPLOAD */}
          {activeTab === 'file' && (
            <div className="space-y-4">
              <input
                type="file"
                ref={fileInputRef}
                accept=".xlsx,.xls,.csv,.json,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv,application/json"
                onChange={handleFileChange}
                className="hidden"
              />

              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-indigo-200 hover:border-indigo-500 bg-indigo-50/30 hover:bg-indigo-50/60 rounded-3xl p-8 text-center cursor-pointer transition-all duration-200 group"
              >
                <div className="w-16 h-16 rounded-2xl bg-white shadow-md text-indigo-600 flex items-center justify-center mx-auto mb-4 group-hover:scale-105 transition-transform">
                  <FileSpreadsheet className="w-8 h-8" />
                </div>
                <h3 className="text-sm md:text-base font-bold text-slate-800 mb-1">
                  এখানে ক্লিক করে আপনার Excel (.xlsx), CSV বা JSON ফাইল সিলেক্ট করুন
                </h3>
                <p className="text-xs text-slate-500 max-w-lg mx-auto leading-relaxed">
                  গুগল শিট বা মাইক্রোসফট এক্সেল থেকে এক্সপোর্ট করা <span className="font-semibold text-indigo-600">.xlsx</span> বা <span className="font-semibold text-indigo-600">.csv</span> ফাইল ড্রপ করুন। সিস্টেম স্বয়ংক্রিয়ভাবে কলামসমূহ ম্যাপিং করে নেবে।
                </p>

                {uploadedFileName && (
                  <div className="mt-4 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-100 text-emerald-800 text-xs font-semibold">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>সিলেক্টেড ফাইল: {uploadedFileName}</span>
                  </div>
                )}

                {isProcessingFile && (
                  <div className="mt-4 flex items-center justify-center gap-2 text-xs font-semibold text-indigo-600">
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>ফাইল প্রসেস ও ভ্যালিডেশন করা হচ্ছে...</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: RAW BENGALI TEXT PARSER */}
          {activeTab === 'text' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                    মাইক্রোসফট ওয়ার্ড বা ফেসবুক পোস্ট থেকে সরাসরি প্রশ্ন পেস্ট করুন:
                  </h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    প্যাটার্ন: <code className="bg-slate-100 px-1 py-0.5 rounded text-indigo-700">১. প্রশ্ন... (ক) অপশন (খ) অপশন (গ) অপশন (ঘ) অপশন উত্তর: ক ব্যাখ্যা: ...</code>
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleLoadSampleBengaliText}
                  className="px-3 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                  নমুনা টেক্সট পেস্ট করুন
                </button>
              </div>

              <textarea
                value={rawBengaliTextInput}
                onChange={(e) => setRawBengaliTextInput(e.target.value)}
                placeholder="এখানে বাংলা বা ইংরেজি প্রশ্ন পেস্ট করুন...&#10;&#10;১. প্রশ্ন বাক্য...&#10;(ক) অপশন ১&#10;(খ) অপশন ২&#10;(গ) অপশন ৩&#10;(ঘ) অপশন ৪&#10;উত্তর: ক&#10;ব্যাখ্যা: সমাধানের বিস্তারিত ব্যাখ্যা..."
                rows={8}
                className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-xs font-mono text-slate-800 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-hidden leading-relaxed resize-y"
              />

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={handleParseRawText}
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer"
                >
                  <Sparkles className="w-4 h-4" />
                  স্বয়ংক্রিয়ভাবে টেক্সট পার্স করুন (Parse Raw Text)
                </button>
              </div>
            </div>
          )}

          {/* TAB 3: DOWNLOAD READY-MADE TEMPLATES */}
          {activeTab === 'templates' && (
            <div className="space-y-6">
              <div className="p-4 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-start gap-3">
                <Info className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
                <div className="text-xs text-indigo-900 space-y-1">
                  <p className="font-bold">রেডিমেড টেমপ্লেট ব্যবহার করে শত শত প্রশ্ন সহজে এন্ট্রি করুন:</p>
                  <p className="text-indigo-800/80 leading-relaxed">
                    নিচের যেকোনো একটি টেমপ্লেট ডাউনলোড করুন। ফাইলে পদার্থবিজ্ঞান, রসায়ন, গণিত ও জীববিজ্ঞানের নমুনা প্রশ্নের কলাম সাজানো রয়েছে। ডেটা এন্ট্রি শেষ করে ফাইলটি এখানে ড্রপ করলেই লাইভ ডেটাবেজে ইমপোর্ট হয়ে যাবে।
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Excel Template Card */}
                <div className="bg-white rounded-2xl p-5 border border-emerald-200 shadow-sm flex flex-col justify-between hover:border-emerald-400 transition-colors">
                  <div>
                    <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-3">
                      <FileSpreadsheet className="w-5 h-5" />
                    </div>
                    <h4 className="text-sm font-bold text-slate-900 mb-1">Excel Template (.xlsx)</h4>
                    <p className="text-xs text-slate-500 leading-relaxed mb-4">
                      মাইক্রোসফট এক্সেল বা গুগল শিট ব্যবহারকারীদের জন্য আদর্শ। সঠিক কলাম ও উইডথ কনফিগার করা।
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={downloadExcelTemplate}
                    className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm transition-colors cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Download Excel Template
                  </button>
                </div>

                {/* CSV Template Card */}
                <div className="bg-white rounded-2xl p-5 border border-blue-200 shadow-sm flex flex-col justify-between hover:border-blue-400 transition-colors">
                  <div>
                    <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mb-3">
                      <FileText className="w-5 h-5" />
                    </div>
                    <h4 className="text-sm font-bold text-slate-900 mb-1">CSV Template (.csv)</h4>
                    <p className="text-xs text-slate-500 leading-relaxed mb-4">
                      UTF-8 BOM এনকোডিং সহ সিএসভি ফাইল। বাংলা ফন্ট কোনো বিকৃতি ছাড়াই এক্সেলে ওপেন হবে।
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={downloadCsvTemplate}
                    className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm transition-colors cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Download CSV Template
                  </button>
                </div>

                {/* JSON Template Card */}
                <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm flex flex-col justify-between hover:border-slate-400 transition-colors">
                  <div>
                    <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center mb-3">
                      <FileJson className="w-5 h-5" />
                    </div>
                    <h4 className="text-sm font-bold text-slate-900 mb-1">JSON Template (.json)</h4>
                    <p className="text-xs text-slate-500 leading-relaxed mb-4">
                      ডেভেলপার ও স্ক্রিপ্টিং ব্যবহারের জন্য স্ট্যান্ডার্ড ফরম্যাটেড JSON অ্যারে টেমপ্লেট।
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={downloadJsonTemplate}
                    className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm transition-colors cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Download JSON Template
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Parse Errors Banner */}
          {parseErrors.length > 0 && (
            <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-xs text-red-800 space-y-1">
              <div className="flex items-center gap-2 font-bold text-red-900">
                <AlertCircle className="w-4 h-4 text-red-600" />
                <span>পার্সিং বা ভ্যালিডেশন ত্রুটি পাওয়া গেছে:</span>
              </div>
              <ul className="list-disc list-inside space-y-0.5 text-red-700 pl-1 font-mono text-[11px]">
                {parseErrors.map((err, i) => (
                  <li key={i}>{err}</li>
                ))}
              </ul>
            </div>
          )}

          {/* PRE-FLIGHT LIVE PREVIEW TABLE */}
          {parsedQuestions.length > 0 && (
            <div className="space-y-4 pt-2 border-t border-slate-200">
              {/* Summary Statistics Bar */}
              <div className="bg-slate-900 text-white rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h4 className="text-sm font-bold flex items-center gap-2">
                    <Eye className="w-4 h-4 text-indigo-400" />
                    <span>ইমপোর্ট প্রি-ফ্লাইট টেবিল (Pre-flight Review)</span>
                  </h4>
                  <p className="text-xs text-slate-400 mt-0.5">
                    মোট <span className="text-white font-bold">{parsedQuestions.length}</span> টি প্রশ্ন শনাক্ত হয়েছে। ডেটাবেজে সাবমিট করার আগে তথ্য যাচাই করুন।
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPreviewFilter('all')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer transition-colors ${
                      previewFilter === 'all' ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    সকল ({parsedQuestions.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewFilter('valid')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer transition-colors ${
                      previewFilter === 'valid' ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-emerald-400 hover:bg-slate-700'
                    }`}
                  >
                    ✅ নির্ভুল ({validCount})
                  </button>
                  {invalidCount > 0 && (
                    <button
                      type="button"
                      onClick={() => setPreviewFilter('invalid')}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer transition-colors ${
                        previewFilter === 'invalid' ? 'bg-red-600 text-white' : 'bg-slate-800 text-red-400 hover:bg-slate-700'
                      }`}
                    >
                      ❌ সমস্যাযুক্ত ({invalidCount})
                    </button>
                  )}
                </div>
              </div>

              {/* Table Container */}
              <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white max-h-80 overflow-y-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200 sticky top-0 z-10">
                    <tr>
                      <th className="py-2.5 px-3 w-12 text-center">#</th>
                      <th className="py-2.5 px-3 w-64">প্রশ্ন (Question & LaTeX)</th>
                      <th className="py-2.5 px-3 w-60">অপশনসমূহ (A, B, C, D)</th>
                      <th className="py-2.5 px-3 w-20 text-center">উত্তর</th>
                      <th className="py-2.5 px-3 w-40">অধ্যায় ও ট্যাগ</th>
                      <th className="py-2.5 px-3 w-24 text-center">স্ট্যাটাস</th>
                      <th className="py-2.5 px-3 w-12 text-center">অ্যাকশন</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredPreview.map((q, idx) => (
                      <tr
                        key={q.id || idx}
                        className={`hover:bg-slate-50 transition-colors ${!q.isValid ? 'bg-red-50/40' : ''}`}
                      >
                        <td className="py-2.5 px-3 text-center text-slate-400 font-bold">{idx + 1}</td>
                        
                        {/* Question Text */}
                        <td className="py-2.5 px-3">
                          <div className="font-medium text-slate-900 line-clamp-3 leading-relaxed">
                            <MathText text={q.question_text} />
                          </div>
                          {q.explanation && (
                            <div className="text-[10px] text-slate-500 mt-1 line-clamp-1 italic">
                              💡 <MathText text={q.explanation} />
                            </div>
                          )}
                        </td>

                        {/* Options */}
                        <td className="py-2.5 px-3 space-y-0.5 text-[11px]">
                          <div className={q.correct_ans === 'A' ? 'font-bold text-emerald-700' : 'text-slate-600'}>
                            (A) <MathText text={q.options.A} />
                          </div>
                          <div className={q.correct_ans === 'B' ? 'font-bold text-emerald-700' : 'text-slate-600'}>
                            (B) <MathText text={q.options.B} />
                          </div>
                          <div className={q.correct_ans === 'C' ? 'font-bold text-emerald-700' : 'text-slate-600'}>
                            (C) <MathText text={q.options.C} />
                          </div>
                          <div className={q.correct_ans === 'D' ? 'font-bold text-emerald-700' : 'text-slate-600'}>
                            (D) <MathText text={q.options.D} />
                          </div>
                        </td>

                        {/* Correct Answer */}
                        <td className="py-2.5 px-3 text-center">
                          <span className="inline-block px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-800 font-bold text-xs">
                            {q.correct_ans}
                          </span>
                        </td>

                        {/* Chapter & Tags */}
                        <td className="py-2.5 px-3 text-[11px] text-slate-600">
                          <div className="font-semibold text-slate-800">{q.subject_name || q.subject_id}</div>
                          <div className="text-slate-500">{q.chapter_name || q.chapter_id}</div>
                          {q.tags && q.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {q.tags.slice(0, 2).map((t, ti) => (
                                <span key={ti} className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 text-[10px]">
                                  {t}
                                </span>
                              ))}
                            </div>
                          )}
                        </td>

                        {/* Validation Status */}
                        <td className="py-2.5 px-3 text-center">
                          {q.isValid ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-bold text-[10px]">
                              <Check className="w-3 h-3 text-emerald-600" />
                              Valid
                            </span>
                          ) : (
                            <div className="inline-flex flex-col items-center">
                              <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-bold text-[10px]">
                                Error
                              </span>
                              {q.validationIssues && (
                                <span className="text-[9px] text-red-600 mt-0.5 max-w-[100px] truncate" title={q.validationIssues.join(', ')}>
                                  {q.validationIssues[0]}
                                </span>
                              )}
                            </div>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="py-2.5 px-3 text-center">
                          <button
                            type="button"
                            onClick={() => handleDeleteParsedItem(idx)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                            title="তালিকা থেকে বাদ দিন"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Submit Error */}
          {submitError && (
            <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-xs font-semibold text-red-800 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
              <span>{submitError}</span>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 md:p-6 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <div className="text-xs text-slate-500">
            {parsedQuestions.length > 0 ? (
              <span>
                মোট <strong className="text-slate-800">{validCount}</strong> টি প্রস্তুত প্রশ্ন ডেটাবেজে যুক্ত হতে যাচ্ছে।
              </span>
            ) : (
              <span>ফাইল আপলোড বা টেক্সট পেস্ট করে প্রিভিউ দেখুন।</span>
            )}
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 sm:flex-none px-5 py-2.5 rounded-xl border border-slate-300 text-slate-700 text-xs font-bold hover:bg-slate-100 transition-colors cursor-pointer"
            >
              বাতিল
            </button>

            <button
              type="button"
              disabled={validCount === 0 || isSubmitting}
              onClick={handleFinalSubmit}
              className="flex-1 sm:flex-none px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-md transition-colors cursor-pointer disabled:opacity-40"
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>ডেটাবেজে আপলোড হচ্ছে...</span>
                </>
              ) : (
                <>
                  <Database className="w-4 h-4" />
                  <span>{validCount > 0 ? `এক ক্লিকে ${validCount} টি প্রশ্ন আপলোড করুন` : 'আপলোড করুন'}</span>
                </>
              )}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
