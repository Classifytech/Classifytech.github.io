import React from 'react';
import { ShieldCheck, Mail, Link2, Scale } from 'lucide-react';

interface FooterProps {
  onOpenLegal: (tab: 'terms' | 'privacy' | 'editorial') => void;
  onOpenContact: () => void;
  onOpenLinkMaker?: () => void;
  onOpenCompare?: () => void;
}

export const Footer: React.FC<FooterProps> = ({
  onOpenLegal,
  onOpenContact,
  onOpenLinkMaker,
  onOpenCompare,
}) => {
  return (
    <footer className="border-t border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#04060b] pt-8 pb-10 px-4 sm:px-8 mt-12 space-y-6 w-full text-center text-xs text-slate-600 dark:text-slate-400">
      {/* Brand Identity */}
      <div className="max-w-7xl mx-auto space-y-1.5">
        <div className="font-black text-lg sm:text-xl text-slate-900 dark:text-white tracking-wide">
          CLASSIFY <span className="grad-text">TECH</span>
        </div>
        <p className="text-xs text-slate-600 dark:text-slate-400 max-w-xl mx-auto leading-relaxed">
          Automated Global Tech Trending Aggregator · Top Worldwide Tech News, Official Tipster Leaks, Transformative YouTube Video Summaries, and Multi-Category Comparison.
        </p>
      </div>

      {/* LEGAL & CONTACT NAVIGATION */}
      <div className="max-w-2xl mx-auto pt-2 border-t border-slate-200 dark:border-white/5 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-xs font-bold text-slate-700 dark:text-slate-300">
        {onOpenCompare && (
          <>
            <button
              type="button"
              onClick={onOpenCompare}
              className="hover:text-purple-700 dark:hover:text-[#c084fc] text-purple-700 dark:text-[#c084fc] transition cursor-pointer inline-flex items-center gap-1 font-bold"
            >
              <Scale className="w-3.5 h-3.5" /> Comparison
            </button>
            <span className="text-slate-400 dark:text-slate-600">•</span>
          </>
        )}
        {onOpenLinkMaker && (
          <>
            <button
              onClick={onOpenLinkMaker}
              className="hover:text-cyan-800 dark:hover:text-[#00f2fe] text-cyan-700 dark:text-[#00f2fe] transition cursor-pointer inline-flex items-center gap-1 font-bold"
            >
              <Link2 className="w-3.5 h-3.5" /> Smart Link Maker
            </button>
            <span className="text-slate-400 dark:text-slate-600">•</span>
          </>
        )}
        <button
          onClick={() => onOpenLegal('terms')}
          className="hover:text-cyan-700 dark:hover:text-[#00f2fe] transition cursor-pointer"
        >
          Terms &amp; Conditions
        </button>
        <span className="text-slate-400 dark:text-slate-600">•</span>
        <button
          onClick={() => onOpenLegal('privacy')}
          className="hover:text-cyan-700 dark:hover:text-[#00f2fe] transition cursor-pointer"
        >
          Privacy Policy
        </button>
        <span className="text-slate-400 dark:text-slate-600">•</span>
        <button
          onClick={() => onOpenLegal('editorial')}
          className="hover:text-amber-600 dark:hover:text-amber-400 transition cursor-pointer"
        >
          Editorial Standards
        </button>
        <span className="text-slate-400 dark:text-slate-600">•</span>
        <button
          onClick={onOpenContact}
          className="text-cyan-700 dark:text-[#00f2fe] hover:underline font-extrabold inline-flex items-center gap-1 transition cursor-pointer"
        >
          <Mail className="w-3.5 h-3.5" /> Contact Us &amp; Help Desk
        </button>
      </div>

      {/* STRICT LEGAL DMCA / COPYRIGHT & FAIR USE DISCLAIMER (CRITICAL COMPLIANCE) */}
      <div className="max-w-4xl mx-auto p-4 rounded-2xl bg-white dark:bg-white/[0.03] border border-slate-200 dark:border-white/10 text-left space-y-2 shadow-xs">
        <div className="flex items-center gap-2 text-xs font-bold text-slate-900 dark:text-slate-200">
          <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-[#00e676] shrink-0" />
          <span>Strict Legal DMCA, Fair Use &amp; Affiliate Disclosure</span>
        </div>
        <p id="footerLegalDisclaimer" className="text-[11px] leading-relaxed text-slate-700 dark:text-slate-300 font-medium">
          Disclaimer: CLASSIFY TECH is an independent tech news aggregator. All product names, logos, videos, and brands are property of their respective owners. Content is curated via official public RSS feeds and embeds for informational purposes.
        </p>
        <p className="text-[11px] leading-relaxed text-slate-600 dark:text-slate-400">
          Affiliate Disclosure: Some links on this site are affiliate links powered by our transparent Smart Link Shortener system, which may earn us a referral commission at no extra cost to you.
        </p>
      </div>

      {/* Copyright */}
      <div className="pt-3 border-t border-slate-200 dark:border-white/5 flex items-center justify-center gap-2 text-[11px] text-slate-500">
        <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-[#00e676]" />
        <span>&copy; 2026 CLASSIFY TECH. All Rights Reserved. Independent Global Tech News Aggregator &amp; Comparison Hub.</span>
      </div>
    </footer>
  );
};

