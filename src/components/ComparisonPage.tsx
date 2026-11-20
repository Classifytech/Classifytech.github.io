import React, { useState, useMemo, useEffect } from 'react';
import {
  COMPARISON_CATEGORIES,
  DEEP_SPEC_GROUPS,
  TOTAL_DEEP_SPEC_ROWS_COUNT,
  BUILT_IN_MULTI_CATEGORY_CATALOG,
  TRENDING_MULTI_CATEGORY_COMPARISONS,
  fetchMultiSourceGadgetSpecs,
  type ComparisonCategoryId,
  type DeepComparisonItem,
  type CategoryTrendingPair,
} from '../utils/multiCategoryComparison.ts';
import {
  ArrowLeft,
  Scale,
  Plus,
  X,
  Search,
  Sparkles,
  Loader2,
  ChevronDown,
  ChevronUp,
  SlidersHorizontal,
  Share2,
  Check,
  Zap,
  Smartphone,
  Laptop,
  Tablet,
  Watch,
  Headphones,
  Tv,
  Cpu,
  AlertCircle,
  MessageSquarePlus,
} from 'lucide-react';

interface ComparisonPageProps {
  initialCategory?: ComparisonCategoryId;
  initialPair?: { p1Query: string; p2Query: string } | null;
  onBackToHome: () => void;
  onShowToast?: (msg: string) => void;
  onActiveComparisonChange?: (items: DeepComparisonItem[]) => void;
}

interface SlotState {
  id: string;
  query: string;
  item: DeepComparisonItem | null;
  isLoading: boolean;
  error: string | null;
}

interface CustomComparisonRow {
  id: string;
  label: string;
  values: string[];
}

const getCategoryIcon = (catId: ComparisonCategoryId) => {
  switch (catId) {
    case 'smartphones':
      return <Smartphone className="w-4 h-4" />;
    case 'laptops':
      return <Laptop className="w-4 h-4" />;
    case 'tablets':
      return <Tablet className="w-4 h-4" />;
    case 'smartwatches':
      return <Watch className="w-4 h-4" />;
    case 'earbuds':
      return <Headphones className="w-4 h-4" />;
    case 'tvs':
      return <Tv className="w-4 h-4" />;
    case 'chipsets':
      return <Cpu className="w-4 h-4" />;
  }
};

export const ComparisonPage: React.FC<ComparisonPageProps> = ({
  initialCategory = 'smartphones',
  initialPair,
  onBackToHome,
  onShowToast,
  onActiveComparisonChange,
}) => {
  const [activeCategory, setActiveCategory] = useState<ComparisonCategoryId>(initialCategory);
  const [categoryCatalogs, setCategoryCatalogs] = useState<
    Record<ComparisonCategoryId, DeepComparisonItem[]>
  >(() => ({ ...BUILT_IN_MULTI_CATEGORY_CATALOG }));

  const [slots, setSlots] = useState<SlotState[]>(() => {
    const defaultList = BUILT_IN_MULTI_CATEGORY_CATALOG[initialCategory] || [];
    return [
      {
        id: 'slot-1',
        query: '',
        item: defaultList[0] || null,
        isLoading: false,
        error: null,
      },
      {
        id: 'slot-2',
        query: '',
        item: defaultList[1] || defaultList[0] || null,
        isLoading: false,
        error: null,
      },
    ];
  });

  const [showOnlyDifferences, setShowOnlyDifferences] = useState(false);
  const [specFilterQuery, setSpecFilterQuery] = useState('');
  const [collapsedGroupIds, setCollapsedGroupIds] = useState<Record<string, boolean>>({});
  const [copiedShareLink, setCopiedShareLink] = useState(false);
  const [activeTrendingId, setActiveTrendingId] = useState<string>('');

  // Custom Comparison Parameter / Note state
  const [customRows, setCustomRows] = useState<CustomComparisonRow[]>([]);
  const [customParamLabel, setCustomParamLabel] = useState('');
  const [customParamValues, setCustomParamValues] = useState<string[]>(['', '', '', '']);

  // Sync initialCategory when changed externally
  useEffect(() => {
    handleCategorySwitch(initialCategory);
  }, [initialCategory]);

  // Deep-link initialPair loader
  useEffect(() => {
    if (!initialPair) return;
    if (initialPair.p1Query) {
      void handleLiveFetchSlot(0, initialPair.p1Query, activeCategory);
    }
    if (initialPair.p2Query) {
      void handleLiveFetchSlot(1, initialPair.p2Query, activeCategory);
    }
  }, [initialPair?.p1Query, initialPair?.p2Query]);

  // Notify parent of active comparison items for document.title & SEO
  useEffect(() => {
    if (onActiveComparisonChange) {
      const validItems = slots.map((s) => s.item).filter((i): i is DeepComparisonItem => Boolean(i));
      onActiveComparisonChange(validItems);
    }
  }, [slots]);

  const currentCategoryMeta = useMemo(
    () =>
      COMPARISON_CATEGORIES.find((c) => c.id === activeCategory) || COMPARISON_CATEGORIES[0],
    [activeCategory]
  );

  const currentCatalog = useMemo(
    () => categoryCatalogs[activeCategory] || [],
    [categoryCatalogs, activeCategory]
  );

  const categoryTrendingPairs = useMemo(
    () => TRENDING_MULTI_CATEGORY_COMPARISONS.filter((t) => t.category === activeCategory),
    [activeCategory]
  );

  const handleCategorySwitch = (nextCat: ComparisonCategoryId) => {
    setActiveCategory(nextCat);
    const list = categoryCatalogs[nextCat] || BUILT_IN_MULTI_CATEGORY_CATALOG[nextCat] || [];
    const firstTrending = TRENDING_MULTI_CATEGORY_COMPARISONS.find((t) => t.category === nextCat);
    setActiveTrendingId(firstTrending?.id || '');
    setSlots([
      {
        id: 'slot-1',
        query: '',
        item: list[0] || null,
        isLoading: false,
        error: null,
      },
      {
        id: 'slot-2',
        query: '',
        item: list[1] || list[0] || null,
        isLoading: false,
        error: null,
      },
    ]);
  };

  const handleAddSlot = () => {
    if (slots.length >= 4) return;
    const nextIndex = slots.length;
    const fallbackItem = currentCatalog[nextIndex] || currentCatalog[0] || null;
    setSlots((prev) => [
      ...prev,
      {
        id: `slot-${Date.now()}-${prev.length + 1}`,
        query: '',
        item: fallbackItem,
        isLoading: false,
        error: null,
      },
    ]);
    if (onShowToast) {
      onShowToast(`Added Item #${slots.length + 1} to comparison matrix`);
    }
  };

  const handleRemoveSlot = (indexToRemove: number) => {
    if (slots.length <= 2) return;
    setSlots((prev) => prev.filter((_, idx) => idx !== indexToRemove));
  };

  const handleSelectFromCatalog = (slotIndex: number, itemId: string) => {
    const found = currentCatalog.find((c) => c.id === itemId);
    if (!found) return;
    setActiveTrendingId('');
    setSlots((prev) =>
      prev.map((slot, idx) =>
        idx === slotIndex
          ? { ...slot, item: found, isLoading: false, error: null }
          : slot
      )
    );
  };

  const handleLiveFetchSlot = async (
    slotIndex: number,
    overrideQuery?: string,
    catOverride?: ComparisonCategoryId
  ) => {
    const targetCat = catOverride || activeCategory;
    const rawQuery = (overrideQuery ?? slots[slotIndex]?.query ?? '').trim();
    if (!rawQuery) {
      setSlots((prev) =>
        prev.map((slot, idx) =>
          idx === slotIndex
            ? { ...slot, error: 'Enter any device or chipset name to compare.' }
            : slot
        )
      );
      return;
    }

    setSlots((prev) =>
      prev.map((slot, idx) =>
        idx === slotIndex
          ? { ...slot, query: rawQuery, isLoading: true, error: null }
          : slot
      )
    );

    try {
      const resolved = await fetchMultiSourceGadgetSpecs(rawQuery, targetCat);
      setSlots((prev) =>
        prev.map((slot, idx) =>
          idx === slotIndex
            ? { ...slot, item: resolved, isLoading: false, error: null }
            : slot
        )
      );

      setCategoryCatalogs((prev) => {
        const existing = prev[targetCat] || [];
        if (
          existing.some(
            (e) =>
              e.id.toLowerCase() === resolved.id.toLowerCase() ||
              e.name.toLowerCase() === resolved.name.toLowerCase()
          )
        ) {
          return prev;
        }
        return {
          ...prev,
          [targetCat]: [resolved, ...existing],
        };
      });
    } catch (err: unknown) {
      const msg =
        err instanceof Error && err.message
          ? err.message
          : 'Unable to fetch specifications for that model.';
      setSlots((prev) =>
        prev.map((slot, idx) =>
          idx === slotIndex ? { ...slot, isLoading: false, error: msg } : slot
        )
      );
    }
  };

  const handleSelectTrendingComparison = async (pair: CategoryTrendingPair) => {
    setActiveTrendingId(pair.id);
    const names = pair.itemNames.slice(0, 4);
    const initialSlots: SlotState[] = names.map((name, idx) => ({
      id: `slot-${idx + 1}`,
      query: '',
      item: currentCatalog.find((c) => c.name.toLowerCase() === name.toLowerCase()) || null,
      isLoading: true,
      error: null,
    }));
    setSlots(initialSlots);

    const resolvedItems = await Promise.all(
      names.map((name) => fetchMultiSourceGadgetSpecs(name, pair.category))
    );

    setSlots(
      resolvedItems.map((item, idx) => ({
        id: `slot-${idx + 1}`,
        query: '',
        item,
        isLoading: false,
        error: null,
      }))
    );

    if (onShowToast) {
      onShowToast(`Loaded ${pair.label} (${TOTAL_DEEP_SPEC_ROWS_COUNT} Deep Specs)`);
    }
  };

  const toggleGroupCollapse = (groupId: string) => {
    setCollapsedGroupIds((prev) => ({
      ...prev,
      [groupId]: !prev[groupId],
    }));
  };

  const handleAddCustomRow = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanLabel = customParamLabel.trim();
    if (!cleanLabel) return;
    const newRow: CustomComparisonRow = {
      id: `custom-${Date.now()}`,
      label: cleanLabel,
      values: slots.map((_, idx) => customParamValues[idx]?.trim() || '—'),
    };
    setCustomRows((prev) => [...prev, newRow]);
    setCustomParamLabel('');
    setCustomParamValues(['', '', '', '']);
    if (onShowToast) {
      onShowToast(`Added custom comparison row: "${cleanLabel}"`);
    }
  };

  const handleShareComparisonUrl = async () => {
    const namesSlug = slots
      .map((s) => (s.item?.id || 'device').toLowerCase())
      .slice(0, 2)
      .join('-vs-');
    const origin =
      typeof window !== 'undefined' ? window.location.origin : 'https://classifytechz.blogspot.com';
    const shareUrl = `${origin}/?compare=${encodeURIComponent(namesSlug)}#/comparison`;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(shareUrl);
      }
      setCopiedShareLink(true);
      if (onShowToast) {
        onShowToast('50+ Spec Comparison link copied to clipboard!');
      }
      setTimeout(() => setCopiedShareLink(false), 2600);
    } catch {
      // ignore
    }
  };

  // Filter groups & rows by `specFilterQuery` and `showOnlyDifferences`
  const filteredGroups = useMemo(() => {
    const q = specFilterQuery.trim().toLowerCase();

    return DEEP_SPEC_GROUPS.map((group) => {
      const matchingRows = group.rows.filter((row) => {
        const values = slots.map((s) => (s.item ? s.item.specs[row.key] || '—' : '—'));

        if (showOnlyDifferences && slots.length >= 2) {
          const normalizedVals = values.map((v) => v.trim().toLowerCase());
          const allSame = normalizedVals.every((v) => v === normalizedVals[0]);
          if (allSame) return false;
        }

        if (!q) return true;
        const labelMatch = row.label.toLowerCase().includes(q);
        const keywordMatch = row.keywords.some((k) => k.toLowerCase().includes(q));
        const valMatch = values.some((v) => v.toLowerCase().includes(q));
        return labelMatch || keywordMatch || valMatch;
      });

      return {
        ...group,
        rows: matchingRows,
      };
    }).filter((g) => g.rows.length > 0);
  }, [specFilterQuery, showOnlyDifferences, slots]);

  const visibleRowCount = useMemo(
    () => filteredGroups.reduce((acc, g) => acc + g.rows.length, 0),
    [filteredGroups]
  );

  const gridColsClass =
    slots.length === 4
      ? 'grid-cols-2 lg:grid-cols-4'
      : slots.length === 3
      ? 'grid-cols-2 lg:grid-cols-3'
      : 'grid-cols-2';

  return (
    <section
      id="dedicatedComparisonPage"
      className="w-full space-y-5 pb-10 animate-in fade-in duration-200"
    >
      {/* Top Sticky Navigation Bar with "<- Back to Home" Button */}
      <div className="sticky top-14 z-30 rounded-2xl px-4 py-3 border border-slate-200 dark:border-cyan-500/35 bg-white/95 dark:bg-[#090d18]/95 backdrop-blur-xl shadow-lg flex flex-wrap items-center justify-between gap-3">
        <button
          id="backToHomeBtn"
          type="button"
          onClick={onBackToHome}
          className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/15 text-slate-900 dark:text-white font-black text-xs sm:text-sm inline-flex items-center gap-2 cursor-pointer transition shadow-xs"
        >
          <ArrowLeft className="w-4 h-4 text-cyan-600 dark:text-[#00f2fe]" />
          <span>&larr; Back to Home</span>
        </button>

        <div className="flex items-center gap-2 flex-wrap">
          <span className="hidden md:inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-[#00e676] text-xs font-extrabold">
            ⚡ {TOTAL_DEEP_SPEC_ROWS_COUNT} Deep Technical Specs • Smartprix / GSMArena / NanoReview Engine
          </span>

          {slots.length < 4 && (
            <button
              id="addCompareItemBtn"
              type="button"
              onClick={handleAddSlot}
              className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-[#00f2fe] to-[#c084fc] hover:opacity-95 text-slate-950 font-black text-xs inline-flex items-center gap-1.5 cursor-pointer transition shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>+ Add Item to Compare ({slots.length}/4)</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleShareComparisonUrl}
            className="px-3.5 py-2 rounded-xl border border-cyan-500/40 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-800 dark:text-[#00f2fe] font-black text-xs inline-flex items-center gap-1.5 cursor-pointer transition"
          >
            {copiedShareLink ? <Check className="w-3.5 h-3.5" /> : <Share2 className="w-3.5 h-3.5" />}
            <span>{copiedShareLink ? 'Copied!' : 'Share'}</span>
          </button>
        </div>
      </div>

      {/* Page Title & All-in-One 7 Category Tabs */}
      <div className="glass-card rounded-3xl p-5 sm:p-7 border border-slate-200 dark:border-cyan-500/30 bg-white dark:bg-[#0b1120] shadow-xl space-y-5">
        <div className="space-y-1.5">
          <div className="text-xs font-black uppercase tracking-wider text-cyan-700 dark:text-[#00f2fe] inline-flex items-center gap-1.5">
            <Scale className="w-4 h-4" />
            <span>ALL-IN-ONE MULTI-CATEGORY HARDWARE COMPARISON HUB</span>
          </div>
          <h1 className="text-2xl sm:text-4xl font-black text-slate-900 dark:text-white tracking-tight">
            50+ Point Deep Technical <span className="grad-text">Comparison</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 max-w-3xl">
            Compare Smartphones, Laptops, Tablets, Smartwatches, Earbuds, Smart TVs, and Chipsets side-by-side across {TOTAL_DEEP_SPEC_ROWS_COUNT} engineering parameters aggregated from {currentCategoryMeta.ecosystemSources.join(', ')}.
          </p>
        </div>

        {/* 7 Interactive Category Tabs */}
        <div
          id="comparisonCategoryTabs"
          role="tablist"
          aria-label="Comparison gadget categories"
          className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar"
        >
          {COMPARISON_CATEGORIES.map((cat) => {
            const isSelected = activeCategory === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                role="tab"
                aria-selected={isSelected}
                data-category-tab={cat.id}
                onClick={() => handleCategorySwitch(cat.id)}
                className={`px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-black inline-flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer transition border ${
                  isSelected
                    ? 'bg-gradient-to-r from-[#00f2fe] via-[#4facfe] to-[#c084fc] text-slate-950 border-transparent shadow-md'
                    : 'bg-slate-100 dark:bg-slate-900/90 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-white/10 hover:border-cyan-500/50'
                }`}
              >
                {getCategoryIcon(cat.id)}
                <span>{cat.tabLabel}</span>
              </button>
            );
          })}
        </div>

        {/* Trending Comparisons (Smartprix / NanoReview / GSMArena) Quick-Select Bar */}
        <div
          id="trendingComparisonsBar"
          className="rounded-2xl p-3.5 sm:p-4 border border-slate-200 dark:border-cyan-500/25 bg-slate-50/90 dark:bg-black/40 space-y-2.5"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-[11px] sm:text-xs font-black uppercase tracking-wider text-cyan-700 dark:text-[#00f2fe] inline-flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400" />
              <span>Trending Comparisons (Smartprix / NanoReview / GSMArena)</span>
            </span>
            <span className="text-[10px] sm:text-[11px] font-bold text-slate-600 dark:text-slate-400">
              1-Click Instant Load • {currentCategoryMeta.tabLabel}
            </span>
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
            {categoryTrendingPairs.map((pair) => {
              const isSelected = activeTrendingId === pair.id;
              return (
                <button
                  key={pair.id}
                  type="button"
                  onClick={() => void handleSelectTrendingComparison(pair)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-extrabold whitespace-nowrap inline-flex items-center gap-2 transition cursor-pointer shrink-0 border ${
                    isSelected
                      ? 'bg-gradient-to-r from-[#00f2fe] to-[#c084fc] text-slate-950 border-transparent shadow-xs'
                      : 'bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 border-slate-200 dark:border-white/10 hover:border-cyan-500/50'
                  }`}
                >
                  <span>{pair.label}</span>
                  <span
                    className={`px-1.5 py-0.5 rounded text-[10px] font-black ${
                      isSelected
                        ? 'bg-slate-950/15 text-slate-950'
                        : 'bg-cyan-500/10 text-cyan-700 dark:text-[#00f2fe]'
                    }`}
                  >
                    {pair.sourceBadge}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Multi-Slot Device Selector Cards (2 to 4 Items) */}
        <div className={`grid ${gridColsClass} gap-3 sm:gap-4 items-start`}>
          {slots.map((slot, idx) => (
            <div
              key={slot.id}
              className="rounded-2xl p-3.5 sm:p-4 border border-slate-200 dark:border-white/15 bg-slate-50/70 dark:bg-black/50 space-y-2.5 min-w-0"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-black uppercase text-cyan-700 dark:text-[#00f2fe] truncate">
                  Item #{idx + 1}
                </span>
                {slots.length > 2 && idx >= 2 && (
                  <button
                    type="button"
                    onClick={() => handleRemoveSlot(idx)}
                    aria-label={`Remove Item ${idx + 1}`}
                    className="p-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Search & Live Fetch Input */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void handleLiveFetchSlot(idx);
                }}
                className="flex items-center gap-1.5"
              >
                <div className="relative flex-1 min-w-0">
                  <Search className="w-3.5 h-3.5 text-cyan-600 dark:text-[#00f2fe] absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={slot.query}
                    onChange={(e) =>
                      setSlots((prev) =>
                        prev.map((s, sIdx) =>
                          sIdx === idx ? { ...s, query: e.target.value } : s
                        )
                      )
                    }
                    placeholder={currentCategoryMeta.searchPlaceholder}
                    aria-label={`Search Item ${idx + 1}`}
                    className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-cyan-500/35 rounded-xl pl-8 pr-2.5 py-1.5 text-xs font-semibold text-slate-900 dark:text-white placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-[#00f2fe]"
                  />
                </div>
                <button
                  type="submit"
                  disabled={slot.isLoading}
                  className="px-2.5 py-1.5 rounded-xl bg-cyan-600 dark:bg-[#00f2fe] hover:opacity-90 text-white dark:text-slate-950 font-black text-xs inline-flex items-center gap-1 shrink-0 cursor-pointer disabled:opacity-60"
                >
                  {slot.isLoading ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="w-3.5 h-3.5" />
                  )}
                  <span className="hidden sm:inline">Fetch</span>
                </button>
              </form>

              {/* Dropdown Selector */}
              <select
                value={slot.item?.id || ''}
                onChange={(e) => handleSelectFromCatalog(idx, e.target.value)}
                aria-label={`Select Item ${idx + 1}`}
                className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-white/15 rounded-xl px-2.5 py-2 text-xs font-extrabold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-[#00f2fe] cursor-pointer"
              >
                {currentCatalog.map((item, cIdx) => (
                  <option
                    key={`${slot.id}-${item.id}-${cIdx}`}
                    value={item.id}
                    className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                  >
                    {item.name} — {item.priceSummary}
                  </option>
                ))}
              </select>

              {slot.item && (
                <div className="pt-1 flex items-center justify-between gap-2 text-[11px]">
                  <span className="font-black text-slate-900 dark:text-white truncate">
                    {slot.item.name}
                  </span>
                  <span className="font-black text-emerald-700 dark:text-[#00e676] shrink-0">
                    {slot.item.priceSummary.split('(')[0].trim()}
                  </span>
                </div>
              )}

              {slot.error && (
                <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-2.5 py-1.5 flex items-start gap-1.5 text-[11px] text-rose-700 dark:text-rose-300 font-semibold">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  <span>{slot.error}</span>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Spec Row Filter Search Box & "Show Only Differences" Toggle */}
        <div className="pt-2 border-t border-slate-200 dark:border-white/10 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <SlidersHorizontal className="w-4 h-4 text-cyan-600 dark:text-[#00f2fe] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              id="specRowFilterInput"
              type="text"
              value={specFilterQuery}
              onChange={(e) => setSpecFilterQuery(e.target.value)}
              placeholder="Filter Spec Row (e.g., charging, nm, camera, PWM, AnTuTu)..."
              aria-label="Filter specification rows"
              className="w-full bg-slate-50 dark:bg-black/75 border border-slate-300 dark:border-cyan-500/35 rounded-xl pl-10 pr-8 py-2 text-xs sm:text-sm font-semibold text-slate-900 dark:text-white placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-[#00f2fe]"
            />
            {specFilterQuery && (
              <button
                type="button"
                onClick={() => setSpecFilterQuery('')}
                aria-label="Clear specification filter"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <label
              htmlFor="showOnlyDiffToggle"
              className="inline-flex items-center gap-2.5 px-3.5 py-2 rounded-xl border border-slate-300 dark:border-white/15 bg-slate-50 dark:bg-white/5 cursor-pointer select-none text-xs font-extrabold text-slate-800 dark:text-slate-200"
            >
              <input
                id="showOnlyDiffToggle"
                type="checkbox"
                checked={showOnlyDifferences}
                onChange={(e) => setShowOnlyDifferences(e.target.checked)}
                className="w-4 h-4 accent-[#00f2fe] rounded cursor-pointer"
              />
              <span>Show Only Differences</span>
            </label>

            <span className="text-xs font-bold text-slate-600 dark:text-slate-400">
              Showing <strong className="text-cyan-700 dark:text-[#00f2fe]">{visibleRowCount}</strong> of {TOTAL_DEEP_SPEC_ROWS_COUNT} specs
            </span>
          </div>
        </div>
      </div>

      {/* 8 Collapsible Sub-Headers with 62 A-to-Z Deep Technical Specification Rows */}
      <div className="space-y-4">
        {filteredGroups.map((group) => {
          const isCollapsed = Boolean(collapsedGroupIds[group.id]);
          return (
            <div
              key={group.id}
              data-spec-group={group.id}
              className="glass-card rounded-3xl border border-slate-200 dark:border-white/15 bg-white dark:bg-[#0b1120] shadow-lg overflow-hidden"
            >
              {/* Collapsible Group Sub-Header */}
              <button
                type="button"
                onClick={() => toggleGroupCollapse(group.id)}
                aria-expanded={!isCollapsed}
                className="w-full px-5 py-4 bg-slate-100/80 dark:bg-white/[0.04] border-b border-slate-200 dark:border-white/10 flex items-center justify-between gap-4 text-left cursor-pointer hover:bg-slate-200/60 dark:hover:bg-white/[0.07] transition"
              >
                <div>
                  <h2 className="text-sm sm:text-base font-black text-slate-900 dark:text-white">
                    {group.title}
                  </h2>
                  <p className="text-[11px] sm:text-xs text-slate-600 dark:text-slate-400">
                    {group.subtitle} ({group.rows.length} parameters)
                  </p>
                </div>
                <div className="flex items-center gap-2 text-xs font-bold text-cyan-700 dark:text-[#00f2fe] shrink-0">
                  <span>{isCollapsed ? 'Expand' : 'Collapse'}</span>
                  {isCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
                </div>
              </button>

              {/* Group Specification Rows */}
              {!isCollapsed && (
                <div className="divide-y divide-slate-200/70 dark:divide-white/10">
                  {group.rows.map((row) => (
                    <div
                      key={row.key}
                      data-spec-row={row.key}
                      className="p-3.5 sm:p-4 space-y-2 hover:bg-slate-50/80 dark:hover:bg-white/[0.02] transition"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] sm:text-xs font-black uppercase tracking-wide text-cyan-800 dark:text-[#00f2fe]">
                          {row.index}. {row.label}
                        </span>
                      </div>

                      <div className={`grid ${gridColsClass} gap-2.5 sm:gap-4`}>
                        {slots.map((slot, sIdx) => {
                          const val = slot.item?.specs[row.key] || '—';
                          return (
                            <div
                              key={`${row.key}-slot-${sIdx}`}
                              className="p-3 rounded-2xl bg-slate-50 dark:bg-black/50 border border-slate-200/90 dark:border-white/10 text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-200 break-words"
                            >
                              <div className="text-[10px] font-bold uppercase text-slate-400 dark:text-slate-500 mb-0.5 truncate">
                                {slot.item?.name || `Item #${sIdx + 1}`}
                              </div>
                              <div>{val}</div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}

        {/* User Custom Comparison Parameters / Notes Builder */}
        <div className="glass-card rounded-3xl p-5 sm:p-6 border border-slate-200 dark:border-cyan-500/25 bg-white dark:bg-[#0b1120] space-y-4">
          <div className="flex items-center gap-2 text-sm sm:text-base font-black text-slate-900 dark:text-white">
            <MessageSquarePlus className="w-4 h-4 text-cyan-600 dark:text-[#00f2fe]" />
            <span>Custom Comparison Notes &amp; Parameters</span>
          </div>

          {customRows.length > 0 && (
            <div className="space-y-3 pb-2">
              {customRows.map((cRow) => (
                <div
                  key={cRow.id}
                  className="p-3.5 rounded-2xl bg-cyan-500/5 border border-cyan-500/25 space-y-2"
                >
                  <div className="text-xs font-black uppercase text-cyan-700 dark:text-[#00f2fe]">
                    Custom Parameter: {cRow.label}
                  </div>
                  <div className={`grid ${gridColsClass} gap-2.5`}>
                    {slots.map((slot, idx) => (
                      <div
                        key={`${cRow.id}-${idx}`}
                        className="p-2.5 rounded-xl bg-white dark:bg-black/50 border border-slate-200 dark:border-white/10 text-xs font-semibold text-slate-800 dark:text-slate-200"
                      >
                        <div className="text-[10px] text-slate-400">{slot.item?.name}</div>
                        <div>{cRow.values[idx] || '—'}</div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          <form onSubmit={handleAddCustomRow} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
              <input
                type="text"
                value={customParamLabel}
                onChange={(e) => setCustomParamLabel(e.target.value)}
                placeholder="Custom row title (e.g., My Price Deal / Pros)..."
                className="bg-slate-50 dark:bg-black/70 border border-slate-300 dark:border-white/15 rounded-xl px-3 py-2 text-xs font-semibold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-[#00f2fe]"
              />
              {slots.map((slot, idx) => (
                <input
                  key={`custom-input-${slot.id}`}
                  type="text"
                  value={customParamValues[idx] || ''}
                  onChange={(e) => {
                    const next = [...customParamValues];
                    next[idx] = e.target.value;
                    setCustomParamValues(next);
                  }}
                  placeholder={`Note for ${slot.item?.name || `Item #${idx + 1}`}...`}
                  className="bg-slate-50 dark:bg-black/70 border border-slate-300 dark:border-white/15 rounded-xl px-3 py-2 text-xs font-semibold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-[#00f2fe]"
                />
              ))}
            </div>
            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-cyan-600 dark:bg-[#00f2fe] text-white dark:text-slate-950 font-black text-xs inline-flex items-center gap-1.5 cursor-pointer hover:opacity-90 transition"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Custom Comparison Row</span>
            </button>
          </form>
        </div>
      </div>
    </section>
  );
};
