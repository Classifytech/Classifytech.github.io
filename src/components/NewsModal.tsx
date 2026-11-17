import React, { useState, useEffect, useRef } from 'react';
import { TechArticle, formatCleanCategoryBadge } from '../data/newsData.ts';
import { shareArticle } from '../utils/shareUtils.ts';
import { handleImageFallback } from '../utils/imageFallback.ts';
import { X, Clock, Flag, CheckCircle2, Send, Heart, Share2, Copy, Check, ExternalLink, Sparkles } from 'lucide-react';

interface NewsModalProps {
  article: TechArticle | null;
  initialReportOpen?: boolean;
  isFavorited?: boolean;
  onToggleFavorite?: (article: TechArticle) => void;
  onClose: () => void;
  onShowToast: (msg: string) => void;
}

export const NewsModal: React.FC<NewsModalProps> = ({
  article,
  initialReportOpen = false,
  isFavorited = false,
  onToggleFavorite,
  onClose,
  onShowToast,
}) => {
  const [showReport, setShowReport] = useState(initialReportOpen);
  const [reportReason, setReportReason] = useState('Typo / Specification Correction');
  const [reportEmail, setReportEmail] = useState('');
  const [reportDetails, setReportDetails] = useState('');
  const [reportSent, setReportSent] = useState(false);
  const [isSubmittingReport, setIsSubmittingReport] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Sync report state when article or initialReportOpen changes
  useEffect(() => {
    setShowReport(initialReportOpen);
  }, [initialReportOpen, article]);

  // Ensure scroll position resets to top when opening a story
  useEffect(() => {
    if (article && scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 0;
    }
  }, [article?.id]);

  // Handle ESC key to dismiss modal
  useEffect(() => {
    if (!article) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [article, onClose]);

  // Lock background scroll safely and restore on close without breaking page position
  useEffect(() => {
    if (!article) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [article]);

  if (!article) return null;

  // Determine readable fair-use summary paragraphs from RSS/editorial digest
  const activeBody =
    Array.isArray(article.fullBody) && article.fullBody.length > 0
      ? article.fullBody
      : article.desc
      ? [article.desc]
      : [];

  // Filter out empty or whitespace-only paragraphs
  const bodyParagraphs = activeBody.filter((p) => typeof p === 'string' && p.trim().length > 0);

  // Lead Summary callout (if distinct from first paragraph)
  const firstPara = bodyParagraphs[0] || '';
  const leadSummary = article.desc && article.desc.trim() !== firstPara.trim() && !firstPara.includes(article.desc)
    ? article.desc.trim()
    : null;

  // Calculate approximate reading time based on total word count
  const totalWords = bodyParagraphs.join(' ').split(/\s+/).filter(Boolean).length;
  const readTimeMinutes = Math.max(1, Math.ceil(totalWords / 180));

  const originUrl = typeof window !== 'undefined' ? window.location.origin : 'https://classifytech.com';
  const deepLinkUrl = `${originUrl}/?story=${encodeURIComponent(article.id)}`;
  const whatsAppShareHref = `https://api.whatsapp.com/send?text=${encodeURIComponent(
    `*${article.title}* — CLASSIFY TECH\n${deepLinkUrl}`
  )}`;
  const telegramShareHref = `https://t.me/share/url?url=${encodeURIComponent(
    deepLinkUrl
  )}&text=${encodeURIComponent(`${article.title} — CLASSIFY TECH`)}`;

  const handleNativeShare = async () => {
    await shareArticle(
      article,
      {
        onSuccess: (method) => {
          if (method === 'native') {
            onShowToast('Article shared successfully!');
          } else {
            onShowToast('Story link copied to clipboard!');
          }
        },
        onError: (err) => {
          onShowToast(err || 'Failed to share article.');
        },
      }
    );
  };

  const handleCopyLink = async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(deepLinkUrl);
      } else {
        const input = document.createElement('input');
        input.value = deepLinkUrl;
        document.body.appendChild(input);
        input.select();
        document.execCommand('copy');
        document.body.removeChild(input);
      }
      setCopiedLink(true);
      onShowToast('Story link copied to clipboard!');
      setTimeout(() => setCopiedLink(false), 2500);
    } catch {
      onShowToast('Failed to copy link.');
    }
  };

  const handleReportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reportDetails.trim()) {
      onShowToast('Please describe the correction or observation.');
      return;
    }
    setIsSubmittingReport(true);
    try {
      const res = await fetch('/api/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          articleId: article.id,
          articleTitle: article.title,
          reason: reportReason,
          email: reportEmail.trim() || undefined,
          details: reportDetails.trim(),
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setReportSent(true);
        onShowToast(data.message || 'Fact-check report logged with editorial desk.');
        setTimeout(() => {
          setShowReport(false);
          setReportSent(false);
          setReportDetails('');
          setReportEmail('');
        }, 1800);
      } else {
        onShowToast(data.error || 'Unable to submit report at this time.');
      }
    } catch {
      onShowToast('Report service currently unavailable. Please check your connection.');
    } finally {
      setIsSubmittingReport(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 md:p-6 overflow-hidden animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="news-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        className="glass-card max-w-3xl w-full rounded-t-3xl sm:rounded-3xl border-t sm:border border-cyan-400/40 overflow-hidden shadow-2xl flex flex-col bg-white dark:bg-slate-950/95 h-[92dvh] sm:h-auto sm:max-h-[88vh] md:max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cover Image & Header */}
        <div className="relative h-36 xs:h-44 sm:h-60 md:h-72 bg-slate-950 shrink-0 overflow-hidden">
          <img
            src={article.img}
            alt={article.title}
            referrerPolicy="no-referrer"
            onError={(e) => handleImageFallback(e, article.category)}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0d1220] via-black/30 to-black/70" />

          {/* Top Actions Floating Controls */}
          <div className="absolute top-2.5 right-2.5 sm:top-4 sm:right-4 flex items-center gap-1.5 sm:gap-2 z-10">
            {/* Native Web Share API Action */}
            <button
              type="button"
              onClick={handleNativeShare}
              aria-label="Share article via device sheet"
              className="w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center transition shadow-lg backdrop-blur-md bg-black/80 text-slate-300 hover:text-white hover:bg-black/90 border border-white/20 hover:border-cyan-400 group cursor-pointer"
              title="Share article via native share sheet"
            >
              <Share2 className="w-3.5 h-3.5 sm:w-5 sm:h-5 transition group-hover:scale-110 group-hover:text-[#00f2fe]" />
            </button>

            {onToggleFavorite && (
              <button
                type="button"
                onClick={() => onToggleFavorite(article)}
                aria-label={isFavorited ? 'Remove from favorites' : 'Save to favorites'}
                aria-pressed={isFavorited}
                className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center transition shadow-lg backdrop-blur-md cursor-pointer ${
                  isFavorited
                    ? 'bg-rose-500 text-white border border-rose-300'
                    : 'bg-black/80 text-slate-300 hover:text-white hover:bg-black/90 border border-white/20 hover:border-rose-400'
                }`}
                title={isFavorited ? 'Remove from favorites' : 'Save to favorites'}
              >
                <Heart
                  className={`w-3.5 h-3.5 sm:w-5 sm:h-5 transition ${
                    isFavorited ? 'fill-white text-white' : 'hover:text-rose-400'
                  }`}
                />
              </button>
            )}

            <button
              onClick={onClose}
              aria-label="Close Article Modal"
              className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-black/80 text-white hover:bg-[#00f2fe] hover:text-black font-black flex items-center justify-center transition border border-white/20 cursor-pointer shadow-lg"
              title="Close modal (Esc)"
            >
              <X className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
          </div>

          {/* Badge & Publication Metadata */}
          <div className="absolute bottom-2.5 left-3 right-3 sm:left-4 sm:right-4 flex flex-wrap items-center gap-1.5 sm:gap-2">
            <span className="px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-md text-[10px] sm:text-xs font-black uppercase bg-[#00f2fe] text-black shadow-sm tracking-wide">
              {formatCleanCategoryBadge(article)}
            </span>
            <span className="text-[10px] sm:text-[11px] text-slate-300 font-semibold bg-black/80 px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-md flex items-center gap-1 sm:gap-1.5 backdrop-blur-md border border-white/10">
              <Clock className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-[#00f2fe]" /> {article.time} • {readTimeMinutes} min read
            </span>
          </div>
        </div>

        {/* Content Body: flex-1 min-h-0 guarantees smooth scrolling and prevents clipping */}
        <div
          ref={scrollContainerRef}
          className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 py-5 sm:p-7 space-y-5 sm:space-y-6 text-slate-800 dark:text-slate-200 leading-relaxed scrollbar-thin"
        >
          {/* Article Title */}
          <h2 id="news-modal-title" className="text-lg sm:text-2xl md:text-3xl font-black text-slate-900 dark:text-white leading-snug sm:leading-snug tracking-tight break-words">
            {article.title}
          </h2>

          {/* Key Takeaways Callout (if present) */}
          {article.bullets && article.bullets.length > 0 && (
            <div className="p-3.5 sm:p-4 rounded-2xl bg-slate-100/90 dark:bg-white/[0.04] border border-slate-200 dark:border-white/10 space-y-2">
              <div className="text-[11px] font-black uppercase tracking-wider text-cyan-700 dark:text-[#00f2fe]">
                Key Engineering Takeaways
              </div>
              <ul className="space-y-1.5 text-xs sm:text-sm text-slate-800 dark:text-slate-200 font-medium">
                {article.bullets.map((bullet, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-600 dark:bg-[#00f2fe] mt-1.5 shrink-0" />
                    <span>{bullet}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* CLASSIFY TECH Analysis: Main, Expanded, Multi-Paragraph Editorial Story */}
          <div className="p-4 sm:p-6 rounded-2xl sm:rounded-3xl bg-slate-50 dark:bg-white/[0.03] border border-cyan-500/25 space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-cyan-500/15 dark:bg-cyan-950/50 border border-cyan-500/30 text-cyan-800 dark:text-[#00f2fe] text-xs font-black uppercase tracking-wider">
              <Sparkles className="w-3.5 h-3.5 text-cyan-600 dark:text-[#00f2fe]" /> CLASSIFY TECH Executive Analysis
            </div>

            <div className="space-y-4 sm:space-y-5 text-sm sm:text-base md:text-lg text-slate-800 dark:text-slate-200 leading-relaxed sm:leading-loose font-normal break-words">
              {(() => {
                const displayParas = leadSummary
                  ? bodyParagraphs.filter((p) => p.trim() !== leadSummary)
                  : bodyParagraphs;
                const finalRenderParas = displayParas.length > 0 ? displayParas : bodyParagraphs;
                return finalRenderParas.map((para, i) => (
                  <p key={i} className="text-slate-800 dark:text-slate-200">
                    {para}
                  </p>
                ));
              })()}
            </div>
          </div>

          {/* BELOW ARTICLE: Clean Publisher Attribution */}
          <div className="mt-4 pt-3 border-t border-slate-200 dark:border-white/10 space-y-3 pb-2 text-xs">
            <div className="p-3 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 flex items-center justify-between gap-2.5">
              <div className="flex items-center gap-2 min-w-0">
                <CheckCircle2 className="w-4 h-4 text-cyan-600 dark:text-[#00f2fe] shrink-0" />
                <div className="text-slate-700 dark:text-slate-300 font-medium truncate">
                  <span className="text-slate-500 dark:text-slate-400">Publisher: </span>
                  <span className="text-slate-900 dark:text-white font-bold">{article.sourceName || 'Syndicated Feed'}</span>
                  <span className="text-slate-400 dark:text-slate-500 mx-1.5">•</span>
                  <span className="text-slate-500 dark:text-slate-400">{article.time}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Prominent Editorial Grievance & Fact-Check Desk Form */}
          {showReport && (
            <div className="p-3.5 sm:p-4 rounded-xl sm:rounded-2xl bg-slate-100 dark:bg-slate-900 border-2 border-amber-500/40 space-y-3 text-xs animate-in fade-in duration-150">
              <div className="flex items-center justify-between text-slate-900 dark:text-white font-bold border-b border-slate-200 dark:border-white/10 pb-2">
                <span className="flex items-center gap-2 text-amber-700 dark:text-amber-300 text-xs sm:text-sm font-black">
                  <Flag className="w-4 h-4" /> Editorial Grievance &amp; Fact-Check Desk
                </span>
                <button
                  onClick={() => setShowReport(false)}
                  className="w-7 h-7 rounded-lg bg-slate-200 dark:bg-white/10 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white flex items-center justify-center cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {reportSent ? (
                <div className="p-3 bg-emerald-500/15 border border-emerald-500/35 rounded-xl text-emerald-800 dark:text-emerald-300 flex items-center gap-2 font-medium">
                  <CheckCircle2 className="w-4 h-4" /> Report received. Our editorial team will review and verify within 24 hours.
                </div>
              ) : (
                <form onSubmit={handleReportSubmit} className="space-y-2.5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] uppercase font-bold text-slate-600 dark:text-slate-400 mb-1">Correction Type</label>
                      <select
                        value={reportReason}
                        onChange={(e) => setReportReason(e.target.value)}
                        className="w-full rounded-xl bg-white dark:bg-black border border-slate-300 dark:border-white/20 px-3 py-2 text-xs text-slate-900 dark:text-slate-200 outline-none"
                      >
                        <option value="Typo / Specification Correction">Typo / Hardware Specification Correction</option>
                        <option value="Editorial Grievance">Editorial Grievance / Fact Verification</option>
                        <option value="Outdated Price Info">Outdated Retail Price or Launch Info</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] uppercase font-bold text-slate-600 dark:text-slate-400 mb-1">Your Email (Optional)</label>
                      <input
                        type="email"
                        placeholder="For status updates..."
                        value={reportEmail}
                        onChange={(e) => setReportEmail(e.target.value)}
                        className="w-full rounded-xl bg-white dark:bg-black border border-slate-300 dark:border-white/20 px-3 py-2 text-xs text-slate-900 dark:text-white outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] uppercase font-bold text-slate-600 dark:text-slate-400 mb-1">Description *</label>
                    <input
                      type="text"
                      required
                      placeholder="Specify the factual inaccuracy or needed update..."
                      value={reportDetails}
                      onChange={(e) => setReportDetails(e.target.value)}
                      className="w-full rounded-xl bg-white dark:bg-black border border-slate-300 dark:border-white/20 px-3 py-2 text-xs text-slate-900 dark:text-white outline-none"
                    />
                  </div>

                  <div className="flex justify-end pt-1">
                    <button
                      type="submit"
                      disabled={isSubmittingReport}
                      className="px-4 sm:px-5 py-2 rounded-xl bg-amber-500/20 border border-amber-500/50 text-amber-800 dark:text-amber-300 hover:bg-amber-500/35 font-black text-xs inline-flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isSubmittingReport ? 'Submitting...' : 'Submit Fact-Check Report'} <Send className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}
        </div>


        {/* Footer with Prominent Viral Share & Official Source Actions */}
        <div className="p-2.5 sm:p-4 bg-slate-100 dark:bg-slate-950/98 border-t border-slate-200 dark:border-white/10 flex flex-wrap items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-1.5 sm:gap-2 min-w-0 flex-wrap">
            {(article.videoUrl || article.sourceUrl) && (
              <a
                href={article.videoUrl || article.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 dark:bg-[#00f2fe] dark:hover:bg-cyan-300 text-white dark:text-slate-950 text-[11px] sm:text-xs font-black inline-flex items-center gap-1.5 transition shadow-sm shrink-0"
              >
                <span>
                  {article.isVideo ||
                  (article.sourceUrl &&
                    (article.sourceUrl.includes('youtube.com') ||
                      article.sourceUrl.includes('youtu.be')))
                    ? 'Watch Original Video'
                    : 'Read Official Source'}
                </span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}

            <button
              type="button"
              onClick={handleCopyLink}
              className="px-2.5 sm:px-3 py-1.5 rounded-xl bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-400/35 text-cyan-800 dark:text-[#00f2fe] text-[11px] sm:text-xs font-bold inline-flex items-center gap-1.5 transition shadow-xs cursor-pointer shrink-0 active:scale-95"
              title="Copy story link to share"
            >
              {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-[#00e676]" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedLink ? 'Copied Link!' : 'Copy Link'}</span>
            </button>

            <a
              href={whatsAppShareHref}
              target="_blank"
              rel="noopener noreferrer"
              className="px-2.5 sm:px-3 py-1.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/35 text-emerald-800 dark:text-[#00e676] text-[11px] sm:text-xs font-bold inline-flex items-center gap-1.5 transition shadow-xs shrink-0"
              title="Share Story on WhatsApp"
            >
              <i className="fab fa-whatsapp text-xs" aria-hidden="true" />
              <span>WhatsApp</span>
            </a>

            <a
              href={telegramShareHref}
              target="_blank"
              rel="noopener noreferrer"
              className="px-2.5 sm:px-3 py-1.5 rounded-xl bg-sky-500/15 hover:bg-sky-500/25 border border-sky-500/35 text-sky-800 dark:text-sky-300 text-[11px] sm:text-xs font-bold inline-flex items-center gap-1.5 transition shadow-xs shrink-0"
              title="Share Story on Telegram"
            >
              <i className="fab fa-telegram text-xs" aria-hidden="true" />
              <span>Telegram</span>
            </a>

            <button
              type="button"
              onClick={handleNativeShare}
              className="px-2.5 sm:px-3 py-1.5 rounded-xl bg-slate-200/80 hover:bg-slate-300 dark:bg-white/10 dark:hover:bg-white/15 border border-slate-300 dark:border-white/15 text-slate-800 dark:text-slate-200 text-[11px] sm:text-xs font-bold inline-flex items-center gap-1 transition cursor-pointer shrink-0"
              title="Share Story (WhatsApp / Telegram / Copy Link)"
            >
              <Share2 className="w-3.5 h-3.5 text-cyan-700 dark:text-[#00f2fe]" />
              <span>Share Story</span>
            </button>

            <button
              onClick={() => setShowReport(!showReport)}
              className="px-2.5 sm:px-3 py-1.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-400/35 text-amber-800 dark:text-amber-300 text-[11px] sm:text-xs font-bold inline-flex items-center gap-1 transition cursor-pointer shrink-0"
              title="Report factual correction or observation"
            >
              <Flag className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Report</span>
            </button>
          </div>

          <button
            onClick={onClose}
            className="px-3.5 sm:px-5 py-1.5 sm:py-2 rounded-xl bg-slate-200 hover:bg-slate-300 dark:bg-white/10 dark:hover:bg-white/20 text-xs font-bold text-slate-800 dark:text-white transition cursor-pointer shrink-0 active:scale-95"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
