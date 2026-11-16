import React, { useEffect, useMemo, useRef, useState } from 'react';
import { handleImageFallback } from '../utils/imageFallback.ts';
import { buildBlurPlaceholderSvgDataUrl } from '../utils/blurPlaceholder.ts';

interface BlurUpImageProps {
  src: string;
  alt: string;
  category?: string;
  className?: string;
  containerClassName?: string;
  loading?: 'lazy' | 'eager';
  decoding?: 'async' | 'sync' | 'auto';
}

/**
 * Lazy-loaded image with a category-matched inline SVG blur-up backdrop.
 * Avoids layout shift and duplicate network requests while revealing high-res
 * thumbnails smoothly once decoded.
 */
export const BlurUpImage: React.FC<BlurUpImageProps> = ({
  src,
  alt,
  category,
  className = '',
  containerClassName = '',
  loading = 'lazy',
  decoding = 'async',
}) => {
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasFailed, setHasFailed] = useState(false);

  const lqipDataUrl = useMemo(
    () => buildBlurPlaceholderSvgDataUrl(category),
    [category]
  );

  useEffect(() => {
    setIsLoaded(false);
    setHasFailed(false);

    const imgEl = imgRef.current;
    if (imgEl) {
      delete imgEl.dataset.hasFallback;
      if (imgEl.complete && imgEl.naturalWidth > 0) {
        setIsLoaded(true);
      }
    }
  }, [src]);

  const handleLoad = () => {
    setIsLoaded(true);
    setHasFailed(false);
  };

  const handleError = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    const alreadyUsedFallback = e.currentTarget.dataset.hasFallback === 'true';
    if (alreadyUsedFallback) {
      setHasFailed(true);
      return;
    }
    handleImageFallback(e, category);
  };

  return (
    <div
      data-blur-up="true"
      data-loaded={isLoaded ? 'true' : 'false'}
      className={`relative w-full h-full overflow-hidden blur-up-shell ${containerClassName}`}
    >
      {/* Inline SVG Blur-Up LQIP Backdrop */}
      <div
        aria-hidden="true"
        className={`absolute inset-0 bg-cover bg-center scale-110 blur-xl transition-opacity duration-500 pointer-events-none ${
          isLoaded && !hasFailed ? 'opacity-0' : 'opacity-100'
        }`}
        style={{ backgroundImage: `url("${lqipDataUrl}")` }}
      />

      {/* Subtle Shimmer Overlay While Image Loads */}
      {!isLoaded && !hasFailed && (
        <div
          aria-hidden="true"
          className="absolute inset-0 blur-up-shimmer pointer-events-none"
        />
      )}

      {/* Primary Lazy-Loaded Thumbnail */}
      <img
        ref={imgRef}
        src={src}
        alt={alt}
        loading={loading}
        decoding={decoding}
        referrerPolicy="no-referrer"
        onLoad={handleLoad}
        onError={handleError}
        className={`relative w-full h-full object-cover blur-up-img ${
          isLoaded && !hasFailed
            ? 'opacity-100 blur-0 scale-100'
            : 'opacity-0 blur-xl scale-105'
        } ${className}`}
      />
    </div>
  );
};
