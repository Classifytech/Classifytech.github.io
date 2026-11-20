import React, { useState } from 'react';
import { TechArticle } from '../data/newsData.ts';
import {
  Newspaper,
  Clock,
  Heart,
  ChevronDown,
  ChevronUp,
  Layers,
} from 'lucide-react';
import { BlurUpImage } from './BlurUpImage.tsx';

interface TechNewsSectionProps {
  articles: TechArticle[];
  favoriteIds?: Set<string>;
  isAdmin?: boolean;
  onSelectArticle: (article: TechArticle) => void;
  onReportArticle?: (article: TechArticle) => void;
  onToggleFavorite?: (article: TechArticle) => void;
  onRefreshRss?: () => void;
  isRssLoading?: boolean;
  lastRssSyncTime?: string;
}

const INITIAL_VISIBLE_COUNT = 6;
const LOAD_MORE_STEP = 6;

const formatCleanCategoryBadge = (article: TechArticle): string => {
  switch (article.category) {
    case 'CHIPSET':
      return 'SILICON & AI';
    case 'CHINA':
      return 'CHINA LAUNCH';
    case 'GLOBAL':
      return 'GLOBAL TECH';
    case 'INDIA':
      return 'INDIA LAUNCH';
    case 'GAMING':
      return 'GAMING & FPS';
    case 'BATTERY':
      return 'BATTERY TECH';
    case '5G':
      return '5G & WIRELESS';
    default:
      return 'TECH NEWS';
  }
};

export const TechNewsSection: React.FC<TechNewsSectionProps> = ({
  articles,
  favoriteIds = new Set(),
  onSelectArticle,
  onToggleFavorite,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [visibleCount, setVisibleCount] = useState<number>(INITIAL_VISIBLE_COUNT);

  const handleCategoryChange = (catKey: string) => {
    setSelectedCategory(catKey);
    setVisibleCount(INITIAL_VISIBLE_COUNT);
  };

  const filteredArticles = articles.filter((item) => {
    if (selectedCategory === 'ALL') return true;
    if (selectedCategory === 'FLAGSHIP') {
      return item.category === 'CHINA' || item.category === 'GLOBAL' || item.category === 'INDIA';
    }
    if (selectedCategory === 'GAMING') {
      return item.category === 'GAMING' || item.category === 'BATTERY';
    }
    if (selectedCategory === 'CHIPSET') return item.category === 'CHIPSET';
    return item.category === selectedCategory;
  });

  const heroArticle =
    filteredArticles.find((a) => a.isHero) ||
    filteredArticles[0] ||
    articles[0];

  const showHero =
    !!heroArticle &&
    filteredArticles.some((a) => a.id === heroArticle.id);

  const allGridArticles = filteredArticles.filter((item) => !showHero || item.id !== heroArticle?.id);
  const visibleGridArticles = allGridArticles.slice(0, visibleCount);
  const remainingCount = Math.max(0, allGridArticles.length - visibleGridArticles.length);

  const categories = [
    { key: 'ALL', label: '🔥 All Trending Tech' },
    { key: 'CHIPSET', label: '⚡ Silicon & NPU' },
    { key: 'FLAGSHIP', label: '📱 Global & China Launches' },
    { key: 'GAMING', label: '🔋 Si-C Battery & Reviews' },
    { key: '5G', label: '📡 Wireless & 5G' },
  ];

  return (
    <section id="techNewsSection" className="space-y-3.5 sm:space-y-4 w-full">
      {/* Visually hidden SEO H1 taking 0px of screen space */}
      <h1 className="sr-only">CLASSIFY TECH - Trending Tech News &amp; Comparison</h1>

      {/* Clean Horizontal Category Filter Bar Directly Below Live Ticker */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-0.5 w-full" role="tablist">
        {categories.map((cat) => (
          <button
            key={cat.key}
            type="button"
            onClick={() => handleCategoryChange(cat.key)}
            role="tab"
            aria-selected={selectedCategory === cat.key}
            className={`px-3.5 py-2 rounded-xl text-xs font-black shrink-0 cursor-pointer transition ${
              selectedCategory === cat.key
                ? 'pill-3d-active'
                : 'pill-3d text-slate-700 dark:text-slate-200 hover:text-cyan-700 dark:hover:text-white'
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* TOP HERO STORY CARD */}
      {showHero && heroArticle && (
        <article
          onClick={() => onSelectArticle(heroArticle)}
          className="relative rounded-3xl overflow-hidden border border-slate-200 dark:border-cyan-500/35 bg-white dark:bg-[#0b1120] shadow-xl p-4 sm:p-6 group hover:border-cyan-500/60 transition-all duration-300 cursor-pointer"
        >
          <div className="relative z-10 flex flex-col lg:flex-row items-stretch gap-5 lg:gap-7">
            <div className="relative w-full lg:w-[46%] aspect-video rounded-2xl overflow-hidden bg-slate-950 shrink-0 shadow-lg border border-slate-200 dark:border-white/10">
              <BlurUpImage
                src={heroArticle.img}
                alt={heroArticle.title}
                category={heroArticle.category}
                loading="eager"
                decoding="async"
                fetchPriority="high"
                className="group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent" />

              {/* 1 Category Badge on Top-Left of Image */}
              <div className="absolute top-3 left-3">
                <span className="px-3 py-1 rounded-md text-[10px] font-black uppercase tracking-wider text-slate-950 bg-[#00f2fe] shadow-md">
                  {formatCleanCategoryBadge(heroArticle)}
                </span>
              </div>

              {/* Save (Heart) Icon on Top-Right of Image */}
              {onToggleFavorite && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleFavorite(heroArticle);
                  }}
                  aria-label={
                    favoriteIds.has(heroArticle.id)
                      ? `Remove ${heroArticle.title} from saved articles`
                      : `Save ${heroArticle.title} to saved articles`
                  }
                  aria-pressed={favoriteIds.has(heroArticle.id)}
                  className={`absolute top-3 right-3 z-10 w-8 h-8 rounded-full flex items-center justify-center transition shadow-lg backdrop-blur-md cursor-pointer ${
                    favoriteIds.has(heroArticle.id)
                      ? 'bg-rose-500 text-white scale-105 border border-rose-300 shadow-rose-500/30'
                      : 'bg-black/70 text-slate-200 hover:text-white hover:bg-black/90 border border-white/20 hover:border-rose-400'
                  }`}
                  title={favoriteIds.has(heroArticle.id) ? 'Remove from saved' : 'Save story'}
                >
                  <Heart
                    className={`w-4 h-4 transition ${
                      favoriteIds.has(heroArticle.id) ? 'fill-white text-white' : 'hover:text-rose-400'
                    }`}
                  />
                </button>
              )}

              {/* Source & Time at Bottom of Image */}
              <div className="video-scrim-chip absolute bottom-2.5 left-3 right-3 flex items-center justify-between text-[10px] text-white font-semibold">
                <span className="px-2.5 py-0.5 rounded-md bg-black/75 backdrop-blur-md border border-white/10 truncate max-w-[65%]">
                  {heroArticle.sourceName || 'The Verge'}
                </span>
                <span className="px-2.5 py-0.5 rounded-md bg-black/75 backdrop-blur-md flex items-center gap-1 shrink-0">
                  <Clock className="w-3 h-3 text-[#00f2fe]" />
                  {heroArticle.time}
                </span>
              </div>
            </div>

            <div className="flex-1 flex flex-col justify-between space-y-3.5">
              <div>
                <h2 className="text-lg sm:text-2xl lg:text-3xl font-black text-slate-900 dark:text-white group-hover:text-cyan-700 dark:group-hover:text-[#00f2fe] transition leading-tight mb-2.5">
                  {heroArticle.title}
                </h2>

                <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                  {heroArticle.desc}
                </p>
              </div>

              <div className="pt-3 border-t border-slate-200 dark:border-white/10 flex items-center justify-between">
                <span className="text-xs text-slate-500 dark:text-slate-400 font-semibold">
                  {heroArticle.sourceName || 'Global Tech Wire'}
                </span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectArticle(heroArticle);
                  }}
                  className="text-cyan-700 dark:text-[#00f2fe] hover:underline flex items-center gap-1 group-hover:translate-x-0.5 transition text-xs sm:text-sm font-extrabold cursor-pointer"
                >
                  <span>Read Story &rarr;</span>
                </button>
              </div>
            </div>
          </div>
        </article>
      )}

      {/* Empty State Fallback */}
      {visibleGridArticles.length === 0 && !showHero && (
        <div className="text-center py-12 px-4 rounded-2xl border border-dashed border-slate-300 dark:border-white/10 bg-slate-50 dark:bg-white/5">
          <Newspaper className="w-8 h-8 text-slate-500 mx-auto mb-2" />
          <p className="text-slate-900 dark:text-white font-bold text-sm">
            No trending stories in this filter right now
          </p>
          <button
            type="button"
            onClick={() => handleCategoryChange('ALL')}
            className="mt-3 px-4 py-2 rounded-xl bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-800 dark:text-[#00f2fe] text-xs font-bold border border-cyan-500/30 transition cursor-pointer"
          >
            Show All Trending Tech News
          </button>
        </div>
      )}

      {/* Unified Trending Tech News Grid (Paginated: Top 6 Cards Initial Render) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 w-full">
        {visibleGridArticles.map((article, idx) => {
          const isFeatured = idx === 0 && !showHero;
          const isFav = favoriteIds.has(article.id);

          return (
            <article
              key={article.id}
              onClick={() => onSelectArticle(article)}
              className={`glass-card glass-card-hover rounded-2xl sm:rounded-3xl overflow-hidden cursor-pointer flex flex-col justify-between group border border-slate-200 dark:border-white/10 hover:border-cyan-500 dark:hover:border-[#00f2fe] transition duration-300 bg-white dark:bg-[#0d1220] ${
                isFeatured ? 'md:col-span-2 lg:col-span-2' : ''
              }`}
            >
              <div className={`relative ${isFeatured ? 'h-48 sm:h-64' : 'h-44'} bg-slate-950 overflow-hidden`}>
                <BlurUpImage
                  src={article.img}
                  alt={article.title}
                  category={article.category}
                  loading="lazy"
                  className="group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#0d1220] via-transparent to-black/30" />

                {/* 1 Category Badge on Top-Left of Image */}
                <div className="absolute top-3 left-3">
                  <span className="px-2.5 py-1 rounded-md text-[10px] font-black uppercase text-slate-950 bg-[#00f2fe] shadow-sm">
                    {formatCleanCategoryBadge(article)}
                  </span>
                </div>

                {/* Save (Heart) Icon on Top-Right of Image */}
                {onToggleFavorite && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleFavorite(article);
                    }}
                    aria-label={
                      isFav
                        ? `Remove ${article.title} from favorites`
                        : `Save ${article.title} to favorites`
                    }
                    aria-pressed={isFav}
                    className={`absolute top-3 right-3 z-10 w-8 h-8 rounded-full flex items-center justify-center transition shadow-lg backdrop-blur-md cursor-pointer ${
                      isFav
                        ? 'bg-rose-500 text-white scale-105 border border-rose-300 shadow-rose-500/30'
                        : 'bg-black/70 text-slate-200 hover:text-white hover:bg-black/90 border border-white/20 hover:border-rose-400'
                    }`}
                    title={isFav ? 'Remove from favorites' : 'Save to favorites'}
                  >
                    <Heart
                      className={`w-4 h-4 transition ${
                        isFav ? 'fill-white text-white' : 'hover:text-rose-400'
                      }`}
                    />
                  </button>
                )}

                {/* Source & Time at Bottom of Image */}
                <div className="video-scrim-chip absolute bottom-2.5 left-3 right-3 flex items-center justify-between text-[10px] text-white font-semibold">
                  <span className="px-2 py-0.5 rounded-md bg-black/75 backdrop-blur-md border border-white/10 truncate max-w-[62%]">
                    {article.sourceName || 'Global Wire'}
                  </span>
                  <span className="px-2 py-0.5 rounded-md bg-black/75 backdrop-blur-md flex items-center gap-1 shrink-0">
                    <Clock className="w-3 h-3 text-[#00f2fe]" /> {article.time}
                  </span>
                </div>
              </div>

              <div className="p-4 sm:p-5 flex-1 flex flex-col justify-between">
                <div>
                  <h3
                    className={`font-black text-slate-900 dark:text-white leading-snug mb-2 group-hover:text-cyan-700 dark:group-hover:text-[#00f2fe] transition ${
                      isFeatured ? 'text-base sm:text-xl' : 'text-sm sm:text-base'
                    }`}
                  >
                    {article.title}
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 leading-relaxed line-clamp-3">
                    {article.desc}
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-200 dark:border-white/10 flex items-center justify-between text-xs font-bold">
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold truncate max-w-[55%]">
                    {article.sourceName || 'Global Wire'}
                  </span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectArticle(article);
                    }}
                    className="text-cyan-700 dark:text-[#00f2fe] hover:underline flex items-center gap-1 group-hover:translate-x-0.5 transition text-xs font-extrabold cursor-pointer"
                  >
                    <span>Read Story &rarr;</span>
                  </button>
                </div>
              </div>
            </article>
          );
        })}
      </div>

      {/* Pagination / "Load More Trending News" Controls */}
      {allGridArticles.length > INITIAL_VISIBLE_COUNT && (
        <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3 rounded-2xl p-4 bg-white dark:bg-[#0b101d] border border-slate-200 dark:border-white/10 shadow-xs">
          <div className="text-xs font-bold text-slate-600 dark:text-slate-400 flex items-center gap-2">
            <Layers className="w-4 h-4 text-cyan-600 dark:text-[#00f2fe]" />
            <span>
              Showing <strong>{visibleGridArticles.length}</strong> of{' '}
              <strong>{allGridArticles.length}</strong> Trending Stories
            </span>
          </div>

          <div className="flex items-center gap-2.5">
            {remainingCount > 0 ? (
              <button
                id="loadMoreNewsBtn"
                type="button"
                onClick={() => setVisibleCount((prev) => prev + LOAD_MORE_STEP)}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#00f2fe] via-[#4facfe] to-[#c084fc] hover:opacity-95 text-slate-950 font-black text-xs sm:text-sm inline-flex items-center gap-2 shadow-md cursor-pointer transition"
              >
                <span>Load More Trending News (+{Math.min(LOAD_MORE_STEP, remainingCount)})</span>
                <ChevronDown className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setVisibleCount(INITIAL_VISIBLE_COUNT)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/15 text-slate-800 dark:text-white font-bold text-xs inline-flex items-center gap-1.5 cursor-pointer transition"
              >
                <span>Show Fewer Stories</span>
                <ChevronUp className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      )}
    </section>
  );
};
