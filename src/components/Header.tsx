import React, { useState } from 'react';
import { Newspaper, Scale, Mail, Menu, X, Heart, Sun, Moon, Link2 } from 'lucide-react';

interface HeaderProps {
  favoritesCount?: number;
  theme?: 'dark' | 'light';
  isComparisonActive?: boolean;
  onToggleTheme?: () => void;
  onOpenContact: () => void;
  onOpenLinkMaker?: () => void;
  onOpenCompare?: () => void;
  onNavigateHomeSection?: (sectionId?: string) => void;
}

export const Header: React.FC<HeaderProps> = ({
  favoritesCount = 0,
  theme = 'dark',
  isComparisonActive = false,
  onToggleTheme,
  onOpenContact,
  onOpenLinkMaker,
  onOpenCompare,
  onNavigateHomeSection,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header
      className={`sticky top-0 z-40 glass-card border-b px-3 sm:px-6 lg:px-8 py-2.5 w-full backdrop-blur-xl transition-colors duration-200 ${
        theme === 'light'
          ? 'bg-white/95 border-slate-200 text-slate-900'
          : 'bg-[#06080f]/95 border-cyan-500/20 text-slate-100'
      }`}
    >
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-2 sm:gap-4">
        {/* Brand Logo & Name */}
        <a
          href="#"
          onClick={(e) => {
            if (onNavigateHomeSection) {
              e.preventDefault();
              onNavigateHomeSection();
            }
          }}
          className="flex items-center gap-2 sm:gap-2.5 min-w-0 shrink group"
        >
          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-br from-[#00f2fe] via-[#8a2be2] to-[#ff2a85] flex items-center justify-center font-black text-black text-xs sm:text-sm shadow-md shadow-cyan-500/20 group-hover:scale-105 transition shrink-0">
            CT
          </div>
          <div className="min-w-0">
            <div
              className={`font-black text-sm sm:text-lg tracking-tight leading-none whitespace-nowrap ${
                theme === 'light' ? 'text-slate-900' : 'text-white'
              }`}
            >
              CLASSIFY <span className="grad-text">TECH</span>
            </div>
            <div className="hidden sm:block text-[10px] font-semibold text-cyan-700 dark:text-[#00f2fe] mt-0.5 truncate tracking-wide">
              Trending Tech News · Comparison
            </div>
          </div>
        </a>

        {/* Clean Desktop Navigation Links (Exact 4 Sections) */}
        <nav className="hidden lg:flex items-center gap-1.5 text-xs font-bold">
          <a
            href="#techNewsSection"
            onClick={(e) => {
              if (onNavigateHomeSection) {
                e.preventDefault();
                onNavigateHomeSection('techNewsSection');
              }
            }}
            className="pill-3d px-3 py-1.5 rounded-xl text-slate-700 dark:text-slate-200 hover:text-cyan-700 dark:hover:text-[#00f2fe] flex items-center gap-1.5 whitespace-nowrap shrink-0"
          >
            <Newspaper className="w-3.5 h-3.5 text-cyan-600 dark:text-[#00f2fe]" /> Trending News
          </a>

          {onOpenCompare ? (
            <button
              id="navComparisonBtn"
              type="button"
              onClick={onOpenCompare}
              className={`px-3 py-1.5 rounded-xl flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer font-bold transition ${
                isComparisonActive
                  ? 'pill-3d-active'
                  : 'pill-3d text-slate-700 dark:text-slate-200 hover:text-purple-700 dark:hover:text-[#c084fc]'
              }`}
            >
              <Scale className="w-3.5 h-3.5 text-purple-600 dark:text-[#c084fc]" /> Comparison
            </button>
          ) : (
            <a
              href="#/comparison"
              className="pill-3d px-3 py-1.5 rounded-xl text-slate-700 dark:text-slate-200 hover:text-purple-700 dark:hover:text-[#c084fc] flex items-center gap-1.5 whitespace-nowrap shrink-0"
            >
              <Scale className="w-3.5 h-3.5 text-purple-600 dark:text-[#c084fc]" /> Comparison
            </a>
          )}

          {onOpenLinkMaker && (
            <button
              type="button"
              onClick={onOpenLinkMaker}
              className="pill-3d px-3 py-1.5 rounded-xl text-cyan-700 dark:text-[#00f2fe] hover:text-slate-900 dark:hover:text-white flex items-center gap-1.5 cursor-pointer font-bold whitespace-nowrap shrink-0"
            >
              <Link2 className="w-3.5 h-3.5 text-cyan-600 dark:text-[#00f2fe]" /> Smart Link Shortener
            </button>
          )}

          <a
            href="#favoritesSection"
            onClick={(e) => {
              if (onNavigateHomeSection) {
                e.preventDefault();
                onNavigateHomeSection('favoritesSection');
              }
            }}
            className="pill-3d px-3 py-1.5 rounded-xl text-slate-700 dark:text-slate-200 hover:text-[#ff2a85] flex items-center gap-1.5 group whitespace-nowrap shrink-0"
          >
            <Heart
              className={`w-3.5 h-3.5 ${
                favoritesCount > 0 ? 'fill-[#ff2a85] text-[#ff2a85]' : 'text-[#ff2a85]'
              }`}
            />
            <span>Saved</span>
            {favoritesCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-[#ff2a85] text-white text-[10px] font-black shadow-sm">
                {favoritesCount}
              </span>
            )}
          </a>
        </nav>

        {/* Cleanly Aligned Mobile & Desktop Action Controls (Light/Dark Toggle, Help, Menu) */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {onToggleTheme && (
            <button
              type="button"
              onClick={onToggleTheme}
              aria-label={`Switch to ${theme === 'dark' ? 'high-contrast light' : 'dark'} mode`}
              title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}
              className="pill-3d h-9 px-2.5 sm:px-3 rounded-xl font-extrabold text-xs transition flex items-center justify-center gap-1.5 shadow-sm cursor-pointer whitespace-nowrap shrink-0"
            >
              {theme === 'dark' ? (
                <>
                  <Sun className="w-4 h-4 text-amber-400 shrink-0" />
                  <span className="hidden md:inline text-amber-300">Light</span>
                </>
              ) : (
                <>
                  <Moon className="w-4 h-4 text-cyan-700 shrink-0" />
                  <span className="hidden md:inline text-slate-800">Dark</span>
                </>
              )}
            </button>
          )}

          <button
            type="button"
            onClick={onOpenContact}
            aria-label="Help and Contact"
            className="pill-3d h-9 px-2.5 sm:px-3 rounded-xl bg-cyan-500/10 border border-cyan-500/35 text-cyan-700 dark:text-[#00f2fe] hover:text-slate-900 dark:hover:text-white font-extrabold text-xs transition flex items-center justify-center gap-1.5 shadow-sm cursor-pointer whitespace-nowrap shrink-0"
          >
            <Mail className="w-3.5 h-3.5 shrink-0" />
            <span className="hidden sm:inline">Help</span>
          </button>

          {/* Mobile Menu Toggle */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle navigation menu"
            aria-expanded={mobileMenuOpen}
            className="lg:hidden w-9 h-9 rounded-xl flex items-center justify-center transition cursor-pointer pill-3d text-slate-800 dark:text-white shrink-0"
          >
            {mobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <nav
          aria-label="Mobile navigation"
          className="lg:hidden mt-2.5 pt-2.5 border-t border-slate-200 dark:border-white/10 grid grid-cols-2 gap-2 text-xs font-bold animate-in fade-in slide-in-from-top-2 duration-150"
        >
          <a
            href="#techNewsSection"
            onClick={(e) => {
              setMobileMenuOpen(false);
              if (onNavigateHomeSection) {
                e.preventDefault();
                onNavigateHomeSection('techNewsSection');
              }
            }}
            className="p-2.5 rounded-xl pill-3d flex items-center gap-2 text-slate-800 dark:text-slate-200"
          >
            <Newspaper className="w-4 h-4 text-cyan-600 dark:text-[#00f2fe] shrink-0" />
            <span className="truncate">Trending News</span>
          </a>

          <button
            type="button"
            onClick={() => {
              setMobileMenuOpen(false);
              if (onOpenCompare) {
                onOpenCompare();
              }
            }}
            className="p-2.5 rounded-xl pill-3d flex items-center gap-2 text-slate-800 dark:text-slate-200 text-left cursor-pointer"
          >
            <Scale className="w-4 h-4 text-purple-600 dark:text-[#c084fc] shrink-0" />
            <span className="truncate">Comparison</span>
          </button>

          {onOpenLinkMaker && (
            <button
              type="button"
              onClick={() => {
                onOpenLinkMaker();
                setMobileMenuOpen(false);
              }}
              className="p-2.5 rounded-xl pill-3d bg-cyan-500/10 border-cyan-500/30 text-cyan-700 dark:text-[#00f2fe] flex items-center gap-2 font-bold cursor-pointer"
            >
              <Link2 className="w-4 h-4 text-cyan-600 dark:text-[#00f2fe] shrink-0" />
              <span className="truncate">Smart Link Shortener</span>
            </button>
          )}

          <a
            href="#favoritesSection"
            onClick={(e) => {
              setMobileMenuOpen(false);
              if (onNavigateHomeSection) {
                e.preventDefault();
                onNavigateHomeSection('favoritesSection');
              }
            }}
            className="p-2.5 rounded-xl pill-3d flex items-center gap-2 text-slate-800 dark:text-slate-200"
          >
            <Heart className="w-4 h-4 fill-[#ff2a85] text-[#ff2a85] shrink-0" />
            <span className="truncate">Saved {favoritesCount > 0 ? `(${favoritesCount})` : ''}</span>
          </a>
        </nav>
      )}
    </header>
  );
};

