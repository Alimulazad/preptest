import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Sparkles,
  BookOpen,
  BrainCircuit,
  GraduationCap,
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  Quote,
  Lightbulb,
} from 'lucide-react';
import { KnowledgeSnippet } from '../types';
import { fetchKnowledgeSnippets } from '../services/api';
import MathText from './MathText';

// Fallback snippets in case backend or network is delayed
const FALLBACK_SNIPPETS: KnowledgeSnippet[] = [
  {
    id: 'fb_1',
    type: 'quote',
    content_bn: 'কঠিন পরিশ্রম কখনো ব্যর্থ হয় না। ঢাকা বিশ্ববিদ্যালয়ের লাল বাসে চড়ার স্বপ্ন পূরণ তোমার হাতেই!',
  },
  {
    id: 'fb_2',
    type: 'formula',
    content_bn: 'পদার্থবিজ্ঞান ১ম পত্র — কাজ-শক্তি উপপাদ্য (Work-Energy Theorem):',
    content_latex: '$W = \\Delta E_k = \\frac{1}{2}m(v^2 - u^2)$',
    subject_id: 'physics_1',
  },
  {
    id: 'fb_3',
    type: 'gk',
    content_bn: 'ঢাকা বিশ্ববিদ্যালয়ের প্রতিষ্ঠাকাল ও প্রথম উপাচার্যের নাম কী?',
    answer_bn: '১৯২১ সালের ১ জুলাই; প্রথম উপাচার্য স্যার পি. জে. হার্টগ।',
    subject_id: 'gk',
  },
  {
    id: 'fb_4',
    type: 'concept',
    content_bn: 'pH নো-ক্যালকুলেটর ট্র্যাপ: $[H^+] = 2 \\times 10^{-3}$ M হলে, $pH = 3 - \\log_{10}(2) = 3 - 0.3010 = 2.70$। এই শর্টকাট DU "ক" ইউনিটে দ্রুত গণনায় কাজে লাগে।',
    subject_id: 'chemistry_1',
  },
];

export const KnowledgeCarousel: React.FC = () => {
  const [snippets, setSnippets] = useState<KnowledgeSnippet[]>(FALLBACK_SNIPPETS);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    let isMounted = true;
    fetchKnowledgeSnippets().then((data) => {
      if (isMounted && data && data.length > 0) {
        setSnippets(data);
      }
    });
    return () => {
      isMounted = false;
    };
  }, []);

  // Auto-advance every 7 seconds
  useEffect(() => {
    if (snippets.length === 0 || isPaused) return;

    timerRef.current = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % snippets.length);
      setShowAnswer(false); // reset answer reveal on slide change
    }, 7000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [snippets.length, isPaused]);

  const handleNext = () => {
    setCurrentIndex((prev) => (prev + 1) % snippets.length);
    setShowAnswer(false);
  };

  const handlePrev = () => {
    setCurrentIndex((prev) => (prev - 1 + snippets.length) % snippets.length);
    setShowAnswer(false);
  };

  const currentSnippet = snippets[currentIndex] || FALLBACK_SNIPPETS[0];

  // Type badge styling & icon
  const getTypeBadge = (type: KnowledgeSnippet['type']) => {
    switch (type) {
      case 'quote':
        return {
          label: 'অনুপ্রেরণা',
          icon: Sparkles,
          bg: 'bg-amber-400/25 text-amber-100 border-amber-300/30',
        };
      case 'formula':
        return {
          label: 'সূত্র ও গণিত',
          icon: BookOpen,
          bg: 'bg-emerald-400/25 text-emerald-100 border-emerald-300/30',
        };
      case 'gk':
        return {
          label: 'সাধারণ জ্ঞান',
          icon: BrainCircuit,
          bg: 'bg-purple-400/25 text-purple-100 border-purple-300/30',
        };
      case 'concept':
        return {
          label: 'কনসেপ্ট নোট',
          icon: GraduationCap,
          bg: 'bg-cyan-400/25 text-cyan-100 border-cyan-300/30',
        };
      default:
        return {
          label: 'স্মার্ট নোট',
          icon: Lightbulb,
          bg: 'bg-white/20 text-white border-white/30',
        };
    }
  };

  const badgeInfo = getTypeBadge(currentSnippet.type);
  const BadgeIcon = badgeInfo.icon;

  return (
    <div
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-blue-700 via-indigo-700 to-indigo-800 text-white p-4 sm:p-5 shadow-sm border border-blue-900/30 min-h-[170px] flex flex-col justify-between select-none"
    >
      {/* Decorative background glow */}
      <div className="absolute -top-10 -right-10 w-44 h-44 bg-white/10 rounded-full blur-2xl pointer-events-none" />
      <div className="absolute -bottom-8 -left-8 w-36 h-36 bg-indigo-400/20 rounded-full blur-xl pointer-events-none" />

      {/* Top Bar: Type Badge & Navigation Arrows */}
      <div className="relative z-10 flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border backdrop-blur-xs ${badgeInfo.bg}`}
          >
            <BadgeIcon className="w-3.5 h-3.5" />
            <span>{badgeInfo.label}</span>
          </div>

          <span className="text-[10px] text-blue-200/80 font-mono font-semibold">
            {currentIndex + 1} / {snippets.length}
          </span>
        </div>

        {/* Prev / Next Buttons */}
        <div className="flex items-center gap-1">
          <button
            onClick={handlePrev}
            className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/25 flex items-center justify-center text-white transition-all active:scale-90 cursor-pointer backdrop-blur-xs"
            title="পূর্ববর্তী"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={handleNext}
            className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/25 flex items-center justify-center text-white transition-all active:scale-90 cursor-pointer backdrop-blur-xs"
            title="পরবর্তী"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Carousel Main Content with Motion Animated Crossfade / Slide */}
      <div className="relative z-10 flex-1 flex flex-col justify-center my-1 min-h-[85px]">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentSnippet.id + '-' + currentIndex}
            initial={{ opacity: 0, x: 25 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -25 }}
            transition={{ duration: 0.35, ease: 'easeOut' }}
            className="w-full"
          >
            {/* Quote Type */}
            {currentSnippet.type === 'quote' && (
              <div className="flex items-start gap-3">
                <Quote className="w-7 h-7 text-amber-300/80 shrink-0 transform -scale-x-100" />
                <p className="text-sm sm:text-base font-medium italic leading-relaxed text-amber-50">
                  {currentSnippet.content_bn}
                </p>
              </div>
            )}

            {/* Formula Type */}
            {currentSnippet.type === 'formula' && (
              <div className="space-y-1.5">
                <p className="text-xs sm:text-sm font-semibold text-emerald-100 leading-snug">
                  {currentSnippet.content_bn}
                </p>
                {currentSnippet.content_latex && (
                  <div className="p-2.5 rounded-xl bg-slate-900/40 backdrop-blur-md border border-emerald-300/30 text-white overflow-x-auto shadow-inner">
                    <MathText
                      text={currentSnippet.content_latex}
                      className="text-white text-center font-mono !text-white [&_*]:!text-white"
                    />
                  </div>
                )}
              </div>
            )}

            {/* GK Question Type */}
            {currentSnippet.type === 'gk' && (
              <div
                onClick={() => setShowAnswer(!showAnswer)}
                className="cursor-pointer group space-y-2 p-2.5 rounded-xl bg-white/10 hover:bg-white/15 border border-white/20 transition-all"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-xs sm:text-sm font-bold text-white leading-snug">
                    <span className="text-purple-300 font-extrabold mr-1">প্রশ্ন:</span>
                    {currentSnippet.content_bn}
                  </p>

                  <div className="shrink-0 inline-flex items-center gap-1 text-[11px] font-bold text-purple-200 bg-purple-900/40 px-2 py-0.5 rounded-full border border-purple-300/30">
                    {showAnswer ? (
                      <>
                        <EyeOff className="w-3 h-3" />
                        <span>লুকান</span>
                      </>
                    ) : (
                      <>
                        <Eye className="w-3 h-3" />
                        <span>উত্তর দেখুন</span>
                      </>
                    )}
                  </div>
                </div>

                {showAnswer && currentSnippet.answer_bn && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="pt-2 border-t border-purple-200/20 text-xs sm:text-sm font-semibold text-amber-200 flex items-start gap-1.5"
                  >
                    <span className="font-bold text-emerald-300 shrink-0">উত্তর:</span>
                    <span>{currentSnippet.answer_bn}</span>
                  </motion.div>
                )}
              </div>
            )}

            {/* Concept Note Type */}
            {currentSnippet.type === 'concept' && (
              <div className="p-2.5 rounded-xl bg-white/10 backdrop-blur-xs border border-teal-200/20">
                <MathText
                  text={currentSnippet.content_bn}
                  className="text-xs sm:text-sm leading-relaxed text-teal-50 font-medium [&_*]:!text-teal-50"
                />
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Bottom Progress / Pagination Dots */}
      <div className="relative z-10 flex items-center justify-center gap-1.5 pt-1">
        {snippets.slice(0, 10).map((snippet, idx) => (
          <button
            key={snippet.id + '-' + idx}
            onClick={() => {
              setCurrentIndex(idx);
              setShowAnswer(false);
            }}
            className={`h-1.5 rounded-full transition-all cursor-pointer ${
              idx === currentIndex
                ? 'w-6 bg-white shadow-xs'
                : 'w-1.5 bg-white/30 hover:bg-white/50'
            }`}
            title={`আইটেম ${idx + 1}`}
          />
        ))}
      </div>
    </div>
  );
};

export default KnowledgeCarousel;
