import React from 'react';
import { Radio } from 'lucide-react';
import type { TechArticle } from '../data/newsData.ts';

interface TickerProps {
  articles?: TechArticle[];
  onSelectArticle?: (article: TechArticle) => void;
}

export const Ticker: React.FC<TickerProps> = ({ articles = [], onSelectArticle }) => {
  const topHeadlines = articles.slice(0, 8);

  return (
    <div className="ticker-bar bg-slate-100 dark:bg-[#070b14] border-b border-slate-200 dark:border-cyan-500/25 py-2 px-3 flex items-center gap-2.5 w-full max-w-full overflow-hidden">
      <div className="shrink-0 inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-gradient-to-r from-[#ff2a85] to-[#8a2be2] text-white text-[10px] font-black uppercase tracking-wider shadow-xs">
        <Radio className="w-3 h-3 animate-pulse" /> LIVE SCOOP
      </div>

      <div className="w-full overflow-hidden relative min-w-0">
        {topHeadlines.length > 0 ? (
          <div className="ticker-track gap-8 text-xs font-semibold text-slate-700 dark:text-slate-300">
            {topHeadlines.map((art, index) => (
              <button
                key={`${art.id}-${index}`}
                type="button"
                onClick={() => onSelectArticle?.(art)}
                className="inline-flex items-center gap-2 hover:text-cyan-700 dark:hover:text-[#00f2fe] transition cursor-pointer text-left shrink-0"
                title={`Read Story: ${art.title}`}
              >
                <span className="text-[10px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-cyan-500/15 text-cyan-800 dark:text-[#00f2fe] border border-cyan-500/25">
                  {art.sourceName || 'Live Wire'}
                </span>
                <span className="font-bold text-slate-900 dark:text-white">{art.title}</span>
                <span className="text-[10px] text-slate-500 dark:text-slate-400">
                  ({art.time || 'Just Now'})
                </span>
              </button>
            ))}
          </div>
        ) : (
          <div className="ticker-track gap-8 text-xs font-semibold text-slate-700 dark:text-slate-300">
            <span className="inline-flex items-center gap-2">
              🔥 <strong>3nm Silicon Wire:</strong> Snapdragon 8 Elite &amp; Dimensity 9400 flagships cross 2.89M points on AnTuTu v10!
            </span>
            <span className="inline-flex items-center gap-2">
              🐦 <strong>Tipster Leak Alert:</strong> Ice Universe &amp; Evan Blass reveal 7000mAh Silicon-Carbon batteries in sub-8.1mm chassis.
            </span>
            <span className="inline-flex items-center gap-2">
              📺 <strong>YouTube Review Digest:</strong> Curated hardware review summaries with direct creator links live below!
            </span>
            <span className="inline-flex items-center gap-2">
              🚀 <strong>Comparison:</strong> Compare Mobiles, Laptops, Tablets, Smartwatches, Earbuds, TVs &amp; Chipsets across 50+ deep technical parameters!
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
