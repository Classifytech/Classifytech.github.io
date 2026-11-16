import React from 'react';
import {
  COMPARISON_CATEGORIES,
  TOTAL_DEEP_SPEC_ROWS_COUNT,
  type ComparisonCategoryId,
} from '../utils/multiCategoryComparison.ts';
import {
  Scale,
  ArrowRight,
  Smartphone,
  Laptop,
  Tablet,
  Watch,
  Headphones,
  Tv,
  Cpu,
  Zap,
} from 'lucide-react';

interface CompareSectionProps {
  onLaunchComparison: (category?: ComparisonCategoryId) => void;
}

const getPillIcon = (id: ComparisonCategoryId) => {
  switch (id) {
    case 'smartphones':
      return <Smartphone className="w-3.5 h-3.5 text-cyan-600 dark:text-[#00f2fe]" />;
    case 'laptops':
      return <Laptop className="w-3.5 h-3.5 text-purple-600 dark:text-[#c084fc]" />;
    case 'tablets':
      return <Tablet className="w-3.5 h-3.5 text-emerald-600 dark:text-[#00e676]" />;
    case 'smartwatches':
      return <Watch className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />;
    case 'earbuds':
      return <Headphones className="w-3.5 h-3.5 text-pink-600 dark:text-[#ff2a85]" />;
    case 'tvs':
      return <Tv className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />;
    case 'chipsets':
      return <Cpu className="w-3.5 h-3.5 text-cyan-600 dark:text-[#00f2fe]" />;
  }
};

export const CompareSection: React.FC<CompareSectionProps> = ({ onLaunchComparison }) => {
  return (
    <section
      id="compareSection"
      className="relative w-full scroll-mt-20"
    >
      <div className="glass-card rounded-3xl p-5 sm:p-8 border border-slate-200 dark:border-cyan-500/35 shadow-xl bg-white dark:bg-[#0d1322] transition-all duration-300">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          {/* Left: Badge, Heading, Description & Category Pills */}
          <div className="space-y-3.5 min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-black text-cyan-700 dark:text-[#00f2fe] uppercase tracking-wider inline-flex items-center gap-1.5">
                <Scale className="w-4 h-4" />
                <span>ALL-IN-ONE {TOTAL_DEEP_SPEC_ROWS_COUNT}-POINT HARDWARE MATRIX</span>
              </span>
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-[10px] font-black text-emerald-700 dark:text-[#00e676] inline-flex items-center gap-1">
                <Zap className="w-3 h-3" /> Smartprix • GSMArena • NanoReview Engine
              </span>
            </div>

            <h2 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white leading-tight">
              <span className="grad-text">Comparison</span>
            </h2>

            <p className="text-slate-600 dark:text-slate-300 text-xs sm:text-sm max-w-2xl leading-relaxed font-medium">
              Compare any gadget side-by-side across 50+ deep technical parameters including nm node, 0-100% charging time, benchmarks, and sensor details
            </p>

            {/* Category Quick-Launch Pills: Mobiles, Laptops, Tablets, Smartwatches, Earbuds, TVs, Chipsets */}
            <div
              id="comparisonLaunchPills"
              className="flex flex-wrap items-center gap-2 pt-1"
            >
              {COMPARISON_CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => onLaunchComparison(cat.id)}
                  className="px-3.5 py-1.5 rounded-xl bg-slate-100 hover:bg-cyan-500/15 dark:bg-white/[0.05] dark:hover:bg-cyan-500/20 border border-slate-200 dark:border-white/10 hover:border-cyan-500/40 text-xs font-extrabold text-slate-800 dark:text-slate-200 inline-flex items-center gap-1.5 transition cursor-pointer"
                >
                  {getPillIcon(cat.id)}
                  <span>{cat.shortPillLabel}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Right: Prominent "Compare Now ->" Action Button */}
          <div className="shrink-0 flex flex-col sm:flex-row lg:flex-col items-stretch sm:items-center lg:items-end gap-2.5">
            <button
              id="openComparisonPageBtn"
              type="button"
              onClick={() => onLaunchComparison('smartphones')}
              className="px-6 sm:px-8 py-4 rounded-2xl bg-gradient-to-r from-[#00f2fe] via-[#4facfe] to-[#c084fc] hover:opacity-95 text-slate-950 font-black text-sm sm:text-base inline-flex items-center justify-center gap-2.5 shadow-lg shadow-cyan-500/25 transition-all cursor-pointer"
            >
              <Scale className="w-4 h-4" />
              <span>Compare Now &rarr;</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};
