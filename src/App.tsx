import React, { useState, useEffect, useMemo, Suspense } from 'react';
import { Header } from './components/Header.tsx';
import { Ticker } from './components/Ticker.tsx';
import { TechNewsSection } from './components/TechNewsSection.tsx';
import { FavoritesSection } from './components/FavoritesSection.tsx';
import { Footer } from './components/Footer.tsx';
import { LinkMakerSection } from './components/LinkMakerSection.tsx';
import { GhostPostView } from './components/GhostPostView.tsx';

// Lazy-loaded components and modals to optimize initial bundle size & webpage load speed
const CompareSection = React.lazy(() =>
  import('./components/CompareSection.tsx').then((m) => ({ default: m.CompareSection }))
);
const ComparisonPage = React.lazy(() =>
  import('./components/ComparisonPage.tsx').then((m) => ({ default: m.ComparisonPage }))
);
const NewsModal = React.lazy(() =>
  import('./components/NewsModal.tsx').then((m) => ({ default: m.NewsModal }))
);
const ContactModal = React.lazy(() =>
  import('./components/ContactModal.tsx').then((m) => ({ default: m.ContactModal }))
);
const LegalModal = React.lazy(() =>
  import('./components/LegalModal.tsx').then((m) => ({ default: m.LegalModal }))
);

// Data & Automation Hooks
import { defaultTechArticles, TechArticle } from './data/newsData.ts';
import {
  fetchGlobalTrendingNews,
  AUTO_REFRESH_INTERVAL_MS,
} from './utils/rssParser.ts';
import { fetchTrendingTechTweets } from './utils/socialRadar.ts';
import { fetchTrendingTechVideos } from './utils/youtubeApi.ts';
import { BUILT_IN_SMARTPHONE_DB } from './utils/phoneComparator.ts';
import {
  type ComparisonCategoryId,
  type DeepComparisonItem,
  COMPARISON_CATEGORIES,
} from './utils/multiCategoryComparison.ts';
import {
  loadFavoritesFromStorage,
  saveFavoritesToStorage,
  toggleFavoriteItem,
  type FavoriteItem,
} from './utils/favorites.ts';
import { extractGhostPostFromLocation } from './utils/affiliate.ts';

import { CheckCircle2 } from 'lucide-react';

declare global {
  interface Window {
    fetchGlobalTrendingNews?: typeof fetchGlobalTrendingNews;
    fetchTrendingTechTweets?: typeof fetchTrendingTechTweets;
    fetchTrendingTechVideos?: typeof fetchTrendingTechVideos;
  }
}

const DEFAULT_DOCUMENT_TITLE =
  'CLASSIFY TECH — Trending Tech News, Leaks & Comparison';

export default function App() {
  const [favorites, setFavorites] = useState<FavoriteItem[]>(() => loadFavoritesFromStorage());

  const [articles, setArticles] = useState<TechArticle[]>(() => {
    try {
      const saved = localStorage.getItem('classify_articles_v6');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length >= 10) return parsed;
      }
    } catch {}
    return defaultTechArticles;
  });

  // RSS Sync State
  const [isRssLoading, setIsRssLoading] = useState(false);
  const [lastRssSyncTime, setLastRssSyncTime] = useState<string>('Just Now');

  // Modal states
  const [selectedArticle, setSelectedArticle] = useState<TechArticle | null>(null);
  const [initialReportOpen, setInitialReportOpen] = useState(false);
  const [contactModalOpen, setContactModalOpen] = useState(false);
  const [legalModalOpen, setLegalModalOpen] = useState(false);
  const [legalModalTab, setLegalModalTab] = useState<'terms' | 'privacy' | 'editorial'>('terms');

  // Parse ?compare=item1-vs-item2 deep link on initial load
  const initialComparePair = useMemo<{ p1Query: string; p2Query: string } | null>(() => {
    try {
      if (typeof window !== 'undefined' && window.location.search) {
        const params = new URLSearchParams(window.location.search);
        const compareParam = params.get('compare');
        if (compareParam && compareParam.includes('-vs-')) {
          const [raw1, raw2] = compareParam.split('-vs-');
          const p1Query = decodeURIComponent(raw1 || '').replace(/-/g, ' ').trim();
          const p2Query = decodeURIComponent(raw2 || '').replace(/-/g, ' ').trim();
          if (p1Query && p2Query) {
            return { p1Query, p2Query };
          }
        }
      }
    } catch {}
    return null;
  }, []);

  // Dedicated Full-Screen Comparison Page SPA Route (#/comparison)
  const [isComparisonRoute, setIsComparisonRoute] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return (
      window.location.hash.startsWith('#/comparison') ||
      Boolean(initialComparePair)
    );
  });

  const [comparisonCategory, setComparisonCategory] = useState<ComparisonCategoryId>(() => {
    if (typeof window !== 'undefined' && window.location.hash.includes('?cat=')) {
      const rawCat = window.location.hash.split('?cat=')[1]?.split('&')[0];
      const matched = COMPARISON_CATEGORIES.find((c) => c.id === rawCat);
      if (matched) return matched.id;
    }
    return 'smartphones';
  });

  const [activeComparedNames, setActiveComparedNames] = useState<{
    name1: string;
    name2: string;
  }>({
    name1: BUILT_IN_SMARTPHONE_DB[0]?.name || 'Samsung Galaxy S25 Ultra',
    name2: BUILT_IN_SMARTPHONE_DB[1]?.name || 'Apple iPhone 16 Pro Max',
  });

  // Sync URL hash changes (#/comparison vs home)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleHashChange = () => {
      const hash = window.location.hash || '';
      if (hash.startsWith('#/comparison')) {
        setIsComparisonRoute(true);
        if (hash.includes('?cat=')) {
          const rawCat = hash.split('?cat=')[1]?.split('&')[0];
          const matched = COMPARISON_CATEGORIES.find((c) => c.id === rawCat);
          if (matched) {
            setComparisonCategory(matched.id);
          }
        }
      } else {
        setIsComparisonRoute(false);
      }
    };

    window.addEventListener('hashchange', handleHashChange);
    window.addEventListener('popstate', handleHashChange);
    return () => {
      window.removeEventListener('hashchange', handleHashChange);
      window.removeEventListener('popstate', handleHashChange);
    };
  }, []);

  // Ghost Post Routing (/s/:shortCode, /post/:id, ?s=code, ?code=code)
  const [ghostPostInfo, setGhostPostInfo] = useState<{ code: string; postId: string } | null>(() => {
    if (typeof window === 'undefined') return null;
    return extractGhostPostFromLocation(
      window.location.pathname || '',
      window.location.search || '',
      window.location.hash || ''
    );
  });

  // Collapsible Workspace States
  const [isLinkMakerOpen, setIsLinkMakerOpen] = useState(true);

  const handleOpenComparePage = (category?: ComparisonCategoryId) => {
    const targetCategory = category || comparisonCategory || 'smartphones';
    setComparisonCategory(targetCategory);
    setIsComparisonRoute(true);
    try {
      if (window.location.hash !== '#/comparison') {
        window.location.hash = '#/comparison';
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch {}
  };

  const handleBackToHome = (targetSectionId?: string) => {
    setIsComparisonRoute(false);
    try {
      const cleanUrl =
        window.location.pathname +
        window.location.search +
        (targetSectionId ? `#${targetSectionId}` : '');
      window.history.pushState(null, '', cleanUrl);
    } catch {}

    if (targetSectionId) {
      if (targetSectionId === 'linkMakerSection') {
        setIsLinkMakerOpen(true);
      }
      setTimeout(() => {
        const el = document.getElementById(targetSectionId);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth' });
        } else {
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }
      }, 60);
    } else {
      try {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } catch {}
    }
  };

  const handleOpenLinkMaker = () => {
    setIsLinkMakerOpen(true);
    if (isComparisonRoute) {
      handleBackToHome('linkMakerSection');
      return;
    }
    setTimeout(() => {
      const el = document.getElementById('linkMakerSection');
      if (el) {
        el.scrollIntoView({ behavior: 'smooth' });
      }
    }, 50);
  };

  // Theme state: default dark mode or high-contrast light mode
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    try {
      const saved = localStorage.getItem('classify_theme');
      if (saved === 'light' || saved === 'dark') return saved;
    } catch {}
    return 'dark';
  });

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'light') {
      root.classList.remove('dark');
      root.classList.add('light');
    } else {
      root.classList.remove('light');
      root.classList.add('dark');
    }
    try {
      localStorage.setItem('classify_theme', theme);
    } catch {}
  }, [theme]);

  const toggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    showToast(`Switched to ${nextTheme === 'light' ? 'High-Contrast Light' : 'Dark'} Mode`);
  };

  // Toast notification state
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev));
    }, 3800);
  };

  // Expose Automation Hooks on window for external API integration
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.fetchGlobalTrendingNews = fetchGlobalTrendingNews;
      window.fetchTrendingTechTweets = fetchTrendingTechTweets;
      window.fetchTrendingTechVideos = fetchTrendingTechVideos;
    }
  }, []);

  // Dynamically update document.title when opening a story or comparing gadgets (Google Discover & Viral SEO)
  useEffect(() => {
    if (typeof document === 'undefined') return;
    if (selectedArticle) {
      document.title = `${selectedArticle.title} | CLASSIFY TECH`;
    } else if (isComparisonRoute && activeComparedNames.name1 && activeComparedNames.name2) {
      document.title = `${activeComparedNames.name1} vs ${activeComparedNames.name2} — Comparison | CLASSIFY TECH`;
    } else {
      document.title = DEFAULT_DOCUMENT_TITLE;
    }
  }, [selectedArticle, isComparisonRoute, activeComparedNames.name1, activeComparedNames.name2]);

  // Dynamically inject comprehensive JSON-LD Schema in <head> (NewsMediaOrganization, WebSite w/ SearchAction, ItemList, FAQPage & Product comparison)
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const origin =
      typeof window !== 'undefined' && window.location.origin
        ? window.location.origin
        : 'https://classifytech.com';

    const p1 = BUILT_IN_SMARTPHONE_DB[0];
    const p2 = BUILT_IN_SMARTPHONE_DB[1];

    const schemaGraph: Record<string, unknown>[] = [
      {
        '@type': ['Organization', 'NewsMediaOrganization'],
        '@id': `${origin}/#organization`,
        name: 'CLASSIFY TECH',
        alternateName: 'CLASSIFY TECH Official',
        description:
          'Independent tech news aggregator and hardware analysis hub curating trending tech news, tipster leaks, YouTube review summaries, and 50+ point multi-category gadget comparisons.',
        sameAs: [
          'https://www.youtube.com/channel/UCp0jHiCTqxDYZ0Bi0sKUmbw',
          'https://youtube.com/@classifytech',
          'https://x.com/classifytechz',
          'https://www.instagram.com/classifytechz/',
          'https://t.me/ClassifytechGroup',
          'https://www.threads.net/@classifytechz',
          'https://www.facebook.com/classifytechz',
        ],
      },
      {
        '@type': 'WebSite',
        '@id': `${origin}/#website`,
        name: 'CLASSIFY TECH',
        url: origin,
        description:
          'CLASSIFY TECH — Trending Tech News, Tipster Leaks, YouTube Review Summaries, and Multi-Category Comparison.',
        inLanguage: 'en',
        publisher: {
          '@id': `${origin}/#organization`,
        },
        potentialAction: {
          '@type': 'SearchAction',
          target: `${origin}/?compare={search_term_string}`,
          'query-input': 'required name=search_term_string',
        },
      },
      {
        '@type': 'ItemList',
        name: 'CLASSIFY TECH Top Trending Tech News',
        itemListElement: articles.slice(0, 9).map((art, index) => ({
          '@type': 'ListItem',
          position: index + 1,
          name: art.title,
          url: `${origin}/?story=${encodeURIComponent(art.id)}`,
        })),
      },
      {
        '@type': 'FAQPage',
        mainEntity: [
          {
            '@type': 'Question',
            name: `How does ${p1.name} compare against ${p2.name} on CLASSIFY TECH?`,
            acceptedAnswer: {
              '@type': 'Answer',
              text: `${p1.name} (${p1.price}, ${p1.cpu}, AnTuTu ${p1.antutu.toLocaleString('en-IN')}, ${p1.battery}) vs ${p2.name} (${p2.price}, ${p2.cpu}, AnTuTu ${p2.antutu.toLocaleString('en-IN')}, ${p2.battery}). Verdict: ${p1.verdict} | ${p2.verdict}`,
            },
          },
          {
            '@type': 'Question',
            name: 'How does the CLASSIFY TECH Comparison engine work?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: 'The CLASSIFY TECH Comparison engine compares Smartphones, Laptops, Tablets, Smartwatches, Earbuds, Smart TVs, and Chipsets side-by-side across 50+ deep technical parameters including nm fabrication node, 0-100% charging speed, benchmarks, and camera sensor specs.',
            },
          },
        ],
      },
      {
        '@type': 'Product',
        name: `${activeComparedNames.name1} vs ${activeComparedNames.name2} Comparison`,
        brand: {
          '@type': 'Brand',
          name: 'CLASSIFY TECH Comparison',
        },
        description: `Side-by-side 50+ point hardware specification comparison between ${activeComparedNames.name1} and ${activeComparedNames.name2}.`,
      },
    ];

    let scriptEl = document.getElementById('classifyTechDynamicSchema') as HTMLScriptElement | null;
    if (!scriptEl) {
      scriptEl = document.createElement('script');
      scriptEl.id = 'classifyTechDynamicSchema';
      scriptEl.type = 'application/ld+json';
      document.head.appendChild(scriptEl);
    }
    scriptEl.textContent = JSON.stringify({
      '@context': 'https://schema.org',
      '@graph': schemaGraph,
    });
  }, [articles, activeComparedNames.name1, activeComparedNames.name2]);

  /**
   * Fetches latest global trending tech news via fetchGlobalTrendingNews()
   * Auto-refreshes every 15 minutes in background without reloading the page.
   */
  const fetchLiveRssNews = async (isManual = false) => {
    setIsRssLoading(true);
    try {
      const result = await fetchGlobalTrendingNews({ refresh: isManual });
      const freshArticles = result.articles;

      if (freshArticles.length > 0 && result.source !== 'curated-fallback') {
        setArticles((prev) => {
          const seen = new Set<string>();
          const deduped: TechArticle[] = [];
          for (const item of [...prev, ...freshArticles]) {
            const key = item.title.toLowerCase().trim();
            if (!seen.has(key)) {
              seen.add(key);
              deduped.push(item);
            }
          }

          deduped.sort((a, b) => {
            if (a.isHero && !b.isHero) return -1;
            if (!a.isHero && b.isHero) return 1;
            return 0;
          });

          return deduped.slice(0, 30);
        });

        setLastRssSyncTime(result.updatedAt);

        if (isManual) {
          showToast(`Synced ${freshArticles.length} live articles across global tech feeds!`);
        }
      } else {
        if (isManual) {
          showToast('Live global tech wire is up to date.');
        }
      }
    } catch {
      if (isManual) {
        showToast('Displaying verified global tech articles.');
      }
    } finally {
      setIsRssLoading(false);
    }
  };

  // Background 15-minute timer for automatic updates without page reload
  useEffect(() => {
    fetchLiveRssNews(false);

    const timerId = setInterval(() => {
      fetchLiveRssNews(false);
    }, AUTO_REFRESH_INTERVAL_MS);

    return () => clearInterval(timerId);
  }, []);

  // Load server-persisted custom articles
  useEffect(() => {
    const loadServerContent = async () => {
      try {
        const res = await fetch('/api/content');
        if (res.ok) {
          const data = await res.json();
          if (data.success && Array.isArray(data.customNews) && data.customNews.length > 0) {
            setArticles((prev) => {
              const seen = new Set(prev.map((a) => a.id));
              const newItems = data.customNews.filter((a: TechArticle) => a && !seen.has(a.id));
              return [...newItems, ...prev];
            });
          }
        }
      } catch (err) {
        console.warn('Could not load server content:', err);
      }
    };

    loadServerContent();

    const handleOnline = () => {
      showToast('Internet restored! Syncing latest live tech news...');
      fetchLiveRssNews(true);
    };
    const handleOffline = () => {
      showToast('You are currently offline. Local cache and comparisons remain active.');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Deep-linking support for shared story links (?story=id)
  useEffect(() => {
    try {
      if (typeof window !== 'undefined' && window.location.search) {
        const params = new URLSearchParams(window.location.search);
        const storyId = params.get('story') || params.get('article');
        if (storyId) {
          const match = articles.find((a) => a.id === storyId);
          if (match) {
            setSelectedArticle(match);
          }
        }
      }
    } catch {}
  }, [articles]);

  // Sync state to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('classify_articles_v6', JSON.stringify(articles));
    } catch {}
  }, [articles]);

  // Sync favorites to localStorage
  useEffect(() => {
    saveFavoritesToStorage(favorites);
  }, [favorites]);

  const favoriteIds = useMemo(() => new Set(favorites.map((f) => f.id)), [favorites]);

  const handleToggleFavoriteArticle = (article: TechArticle) => {
    const res = toggleFavoriteItem(favorites, {
      id: article.id,
      type: 'article',
      data: article,
    });
    setFavorites(res.updated);
    if (res.isFavorited) {
      showToast('Saved to Favorites');
    } else {
      showToast('Removed from Favorites');
    }
  };

  const handleClearAllFavorites = () => {
    setFavorites([]);
  };

  if (ghostPostInfo) {
    return (
      <GhostPostView
        code={ghostPostInfo.code}
        postId={ghostPostInfo.postId}
        onExit={() => {
          setGhostPostInfo(null);
          try {
            window.history.replaceState(null, '', '/');
          } catch {}
        }}
      />
    );
  }

  return (
    <div
      className={`min-h-screen flex flex-col font-sans transition-colors duration-200 selection:bg-[#00f2fe] selection:text-black ${
        theme === 'light' ? 'bg-[#f8fafc] text-slate-900' : 'bg-[#06080f] text-slate-100'
      }`}
    >
      {/* Theme-Aware High-Contrast Toast Notification Alert */}
      {toastMessage && (
        <div
          id="appToastBanner"
          role="status"
          aria-live="polite"
          className={`fixed bottom-6 right-4 left-4 sm:left-auto sm:right-6 z-50 max-w-sm rounded-2xl border-2 px-4 py-3 text-xs sm:text-sm font-extrabold shadow-2xl flex items-center gap-3 animate-in fade-in slide-in-from-bottom-3 duration-200 ${
            theme === 'light'
              ? 'bg-white border-cyan-600 text-slate-900'
              : 'bg-slate-900 border-[#00f2fe] text-white'
          }`}
        >
          <CheckCircle2
            className={`w-5 h-5 shrink-0 ${
              theme === 'light' ? 'text-emerald-600' : 'text-[#00e676]'
            }`}
          />
          <span className="break-words">{toastMessage}</span>
        </div>
      )}

      {/* Main Navigation Header */}
      <Header
        favoritesCount={favorites.length}
        theme={theme}
        onToggleTheme={toggleTheme}
        onOpenContact={() => setContactModalOpen(true)}
        onOpenLinkMaker={handleOpenLinkMaker}
        onOpenCompare={() => handleOpenComparePage()}
        isComparisonActive={isComparisonRoute}
        onNavigateHomeSection={(sectionId) => handleBackToHome(sectionId)}
      />

      {/* Live Tech News Wire Ticker */}
      <Ticker />

      {isComparisonRoute ? (
        /* Dedicated Full-Screen Comparison Page (#/comparison) */
        <main className="max-w-7xl mx-auto px-3.5 sm:px-6 lg:px-8 pt-3 pb-10 sm:pt-4 sm:pb-14 w-full flex-1">
          <Suspense
            fallback={
              <div className="glass-card rounded-2xl p-8 sm:p-12 text-center border border-cyan-500/25 space-y-3">
                <div className="w-8 h-8 border-2 border-[#00f2fe] border-t-transparent rounded-full animate-spin mx-auto" />
                <div className="text-slate-900 dark:text-white font-extrabold text-sm sm:text-base">
                  Loading 50+ Point Multi-Category Comparison...
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  Initializing Smartphones, Laptops, Tablets, Smartwatches, Earbuds, Smart TVs &amp; Chipsets
                </p>
              </div>
            }
          >
            <ComparisonPage
              initialCategory={comparisonCategory}
              initialPair={initialComparePair}
              onBackToHome={() => handleBackToHome()}
              onShowToast={showToast}
              onActiveComparisonChange={(items: DeepComparisonItem[]) => {
                if (items.length >= 2) {
                  setActiveComparedNames({
                    name1: items[0].name,
                    name2: items[1].name,
                  });
                }
              }}
            />
          </Suspense>
        </main>
      ) : (
        /* Primary Homepage Content Container — STRICT 4-SECTION ORDER */
        <main className="max-w-7xl mx-auto px-3.5 sm:px-6 lg:px-8 space-y-10 sm:space-y-14 pt-3 pb-6 sm:pt-4 sm:pb-8 w-full flex-1">
          {/* 1. Unified Trending Tech News (#techNewsSection) */}
          <TechNewsSection
            articles={articles}
            favoriteIds={favoriteIds}
            onSelectArticle={(art) => {
              setSelectedArticle(art);
              setInitialReportOpen(false);
            }}
            onReportArticle={(art) => {
              setSelectedArticle(art);
              setInitialReportOpen(true);
            }}
            onToggleFavorite={handleToggleFavoriteArticle}
            onRefreshRss={() => fetchLiveRssNews(true)}
            isRssLoading={isRssLoading}
            lastRssSyncTime={lastRssSyncTime}
          />

          {/* 2. Sleek Comparison Hero Launch Card (#compareSection) */}
          <Suspense
            fallback={
              <div className="glass-card rounded-2xl p-8 text-center border border-cyan-500/25">
                <div className="text-slate-900 dark:text-white font-extrabold text-sm">
                  Loading Comparison Card...
                </div>
              </div>
            }
          >
            <CompareSection
              onLaunchComparison={(cat) => handleOpenComparePage(cat)}
            />
          </Suspense>

          {/* 3. Smart Link Shortener (#linkMakerSection — Affiliate Logic 100% Untouched) */}
          <LinkMakerSection
            onOpenLegal={(tab) => {
              setLegalModalTab(tab);
              setLegalModalOpen(true);
            }}
            showToast={showToast}
            isExpanded={isLinkMakerOpen}
            onToggleExpand={() => setIsLinkMakerOpen(!isLinkMakerOpen)}
          />

          {/* 4. My Saved Tech Articles (#favoritesSection — Very Bottom Right Above Footer) */}
          <FavoritesSection
            favorites={favorites}
            onToggleFavoriteArticle={handleToggleFavoriteArticle}
            onClearAllFavorites={handleClearAllFavorites}
            onSelectArticle={(art) => {
              setSelectedArticle(art);
              setInitialReportOpen(false);
            }}
            onShowToast={showToast}
          />
        </main>
      )}

      {/* Footer with Legal Disclosures & Copyright Notice */}
      <Footer
        onOpenLegal={(tab) => {
          setLegalModalTab(tab);
          setLegalModalOpen(true);
        }}
        onOpenContact={() => setContactModalOpen(true)}
        onOpenLinkMaker={handleOpenLinkMaker}
        onOpenCompare={() => handleOpenComparePage()}
      />

      {/* Lazy Loaded Modals */}
      <Suspense fallback={null}>
        {selectedArticle && (
          <NewsModal
            article={selectedArticle}
            initialReportOpen={initialReportOpen}
            isFavorited={favoriteIds.has(selectedArticle.id)}
            onToggleFavorite={handleToggleFavoriteArticle}
            onClose={() => {
              setSelectedArticle(null);
              setInitialReportOpen(false);
            }}
            onShowToast={showToast}
          />
        )}
      </Suspense>

      <Suspense fallback={null}>
        {contactModalOpen && (
          <ContactModal
            isOpen={contactModalOpen}
            onClose={() => setContactModalOpen(false)}
            onShowToast={showToast}
          />
        )}

        {legalModalOpen && (
          <LegalModal
            isOpen={legalModalOpen}
            initialTab={legalModalTab}
            onClose={() => setLegalModalOpen(false)}
            onOpenContact={() => {
              setLegalModalOpen(false);
              setContactModalOpen(true);
            }}
          />
        )}
      </Suspense>
    </div>
  );
}
