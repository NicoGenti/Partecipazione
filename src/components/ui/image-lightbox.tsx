import { useEffect, useCallback, type CSSProperties } from 'react';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import type { ImageData } from './img-sphere';

interface ImageLightboxProps {
  images: ImageData[];
  index: number;
  onClose: () => void;
  onNavigate: (index: number) => void;
}

const noDrag: CSSProperties = { userSelect: 'none', WebkitUserDrag: 'none' } as CSSProperties;

export default function ImageLightbox({ images, index, onClose, onNavigate }: ImageLightboxProps) {
  const image = images[index];
  const hasPrev = index > 0;
  const hasNext = index < images.length - 1;
  const showArrows = images.length > 1;

  const prev = useCallback(() => { if (hasPrev) onNavigate(index - 1); }, [hasPrev, index, onNavigate]);
  const next = useCallback(() => { if (hasNext) onNavigate(index + 1); }, [hasNext, index, onNavigate]);

  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = originalOverflow; };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowLeft') prev();
      else if (e.key === 'ArrowRight') next();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose, prev, next]);

  if (!image) return null;

  return (
    <>
      <style>{`
        @keyframes lbFadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes lbScaleIn { from { transform: scale(0.9); opacity: 0; } to { transform: scale(1); opacity: 1; } }
        @media (prefers-reduced-motion: reduce) {
          .lb-overlay, .lb-img { animation: none !important; }
        }
      `}</style>

      <div
        className="lb-overlay fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm"
        onClick={onClose}
        onContextMenu={(e) => e.preventDefault()}
        style={{ animation: 'lbFadeIn 0.25s ease-out' }}
        role="dialog"
        aria-modal="true"
        aria-label="Visualizzazione foto"
      >
        {/* Image container */}
        <div
          className="lb-img relative flex items-center justify-center"
          style={{ animation: 'lbScaleIn 0.25s ease-out', maxWidth: '92vw', maxHeight: '85vh' }}
          onClick={(e) => e.stopPropagation()}
        >
          <img
            src={image.src}
            alt={image.alt}
            className="block rounded-sm border-[3px] border-double border-[#d4af37] shadow-[0_20px_60px_rgba(0,0,0,0.7)]"
            style={{ maxWidth: '92vw', maxHeight: '85vh', objectFit: 'contain', ...noDrag }}
            draggable={false}
            onContextMenu={(e) => e.preventDefault()}
          />

          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-2 right-2 w-10 h-10 bg-[#2c1d11] text-[#d6b772] rounded-full flex items-center justify-center hover:scale-110 transition-transform cursor-pointer border-2 border-[#d6b772] shadow-[0_4px_10px_rgba(0,0,0,0.5)]"
            aria-label="Chiudi"
            autoFocus
          >
            <X size={16} />
          </button>
        </div>

        {/* Prev arrow */}
        {showArrows && (
          <button
            onClick={(e) => { e.stopPropagation(); prev(); }}
            disabled={!hasPrev}
            className="fixed left-3 top-1/2 -translate-y-1/2 w-11 h-11 bg-[#2c1d11]/90 text-[#d6b772] rounded-full flex items-center justify-center border-2 border-[#d6b772]/60 shadow-lg transition-all hover:scale-110 hover:border-[#d6b772] disabled:opacity-20 disabled:cursor-not-allowed cursor-pointer"
            aria-label="Foto precedente"
          >
            <ChevronLeft size={20} />
          </button>
        )}

        {/* Next arrow */}
        {showArrows && (
          <button
            onClick={(e) => { e.stopPropagation(); next(); }}
            disabled={!hasNext}
            className="fixed right-3 top-1/2 -translate-y-1/2 w-11 h-11 bg-[#2c1d11]/90 text-[#d6b772] rounded-full flex items-center justify-center border-2 border-[#d6b772]/60 shadow-lg transition-all hover:scale-110 hover:border-[#d6b772] disabled:opacity-20 disabled:cursor-not-allowed cursor-pointer"
            aria-label="Foto successiva"
          >
            <ChevronRight size={20} />
          </button>
        )}

        {/* Counter */}
        {showArrows && (
          <div
            className="fixed bottom-4 left-1/2 -translate-x-1/2 font-cinzel text-xs uppercase tracking-widest text-[#d6b772] bg-[#2c1d11]/80 px-4 py-1.5 rounded-full border border-[#d6b772]/30 shadow"
            onClick={(e) => e.stopPropagation()}
          >
            {index + 1} / {images.length}
          </div>
        )}
      </div>
    </>
  );
}
