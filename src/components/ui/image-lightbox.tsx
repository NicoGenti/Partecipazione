import { useEffect, useCallback, type CSSProperties } from 'react';
import { X, ChevronLeft, ChevronRight, Glasses, Sparkle } from 'lucide-react';
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
        @keyframes lbScaleIn { 0% { transform: scale(0.92); opacity: 0; } 70% { transform: scale(1.02); opacity: 1; } 100% { transform: scale(1); opacity: 1; } }
        @keyframes lbHaloBreathe { 0%, 100% { opacity: 0.55; } 50% { opacity: 0.85; } }
        @keyframes lbCornerIn { 0% { transform: scale(0.4) rotate(-8deg); opacity: 0; } 100% { transform: scale(1) rotate(0deg); opacity: 1; } }
        @keyframes lbGlintSweep {
          0% { transform: translateX(-110%) skewX(-18deg); opacity: 0; }
          1.6% { transform: translateX(-110%) skewX(-18deg); opacity: 0.45; }
          15.7% { transform: translateX(556%) skewX(-18deg); opacity: 0; }
          100% { transform: translateX(556%) skewX(-18deg); opacity: 0; }
        }
        @keyframes lbCrestSeal { 0% { transform: translateX(-50%) scale(1.15); opacity: 0; } 100% { transform: translateX(-50%) scale(1); opacity: 1; } }
        @keyframes lbSparkleTwinkle { 0%, 100% { opacity: 0.35; transform: scale(0.85); } 50% { opacity: 0.9; transform: scale(1.05); } }
        @media (prefers-reduced-motion: reduce) {
          .lb-overlay, .lb-img { animation: none !important; }
          .lb-halo { animation: none !important; opacity: 0.7; }
          .lb-corner { animation: none !important; transform: none; opacity: 1; }
          .lb-glint { animation: none !important; opacity: 0; }
          .lb-crest { animation: none !important; transform: translateX(-50%); opacity: 1; }
          .lb-sparkle { animation: none !important; opacity: 0.6; transform: none; }
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
          style={{ animation: 'lbScaleIn 0.35s cubic-bezier(0.34, 1.4, 0.64, 1)', maxWidth: '92vw', maxHeight: '85vh' }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Halo — breathing gold glow behind the image */}
          <div
            aria-hidden="true"
            className="lb-halo pointer-events-none absolute -inset-3 -z-10"
            style={{
              background: 'radial-gradient(ellipse at center, rgba(212,175,55,0.25) 0%, transparent 72%)',
              animation: 'lbHaloBreathe 4.8s ease-in-out infinite',
            }}
          />

          <img
            src={image.src}
            alt={image.alt}
            className="block rounded-sm border-[3px] border-double border-[#d4af37] shadow-[0_20px_60px_rgba(0,0,0,0.7)]"
            style={{ maxWidth: '92vw', maxHeight: '85vh', objectFit: 'contain', ...noDrag }}
            draggable={false}
            onContextMenu={(e) => e.preventDefault()}
          />

          {/* Corner flourishes — staggered clockwise entrance from top-left */}
          <div aria-hidden="true" className="pointer-events-none absolute -inset-2">
            <div
              className="lb-corner absolute top-0 left-0 w-[22px] h-[22px] border-t-[3px] border-l-[3px] border-double border-[#d4af37]"
              style={{ animation: 'lbCornerIn 0.4s ease-out 0.18s both' }}
            >
              <div className="absolute top-0 left-0 -translate-x-1/2 -translate-y-1/2 w-[5px] h-[5px] rotate-45 bg-[#d4af37]" />
            </div>
            <div
              className="lb-corner absolute top-0 right-0 w-[22px] h-[22px] border-t-[3px] border-r-[3px] border-double border-[#d4af37]"
              style={{ animation: 'lbCornerIn 0.4s ease-out 0.24s both' }}
            >
              <div className="absolute top-0 right-0 translate-x-1/2 -translate-y-1/2 w-[5px] h-[5px] rotate-45 bg-[#d4af37]" />
            </div>
            <div
              className="lb-corner absolute bottom-0 right-0 w-[22px] h-[22px] border-b-[3px] border-r-[3px] border-double border-[#d4af37]"
              style={{ animation: 'lbCornerIn 0.4s ease-out 0.30s both' }}
            >
              <div className="absolute bottom-0 right-0 translate-x-1/2 translate-y-1/2 w-[5px] h-[5px] rotate-45 bg-[#d4af37]" />
            </div>
            <div
              className="lb-corner absolute bottom-0 left-0 w-[22px] h-[22px] border-b-[3px] border-l-[3px] border-double border-[#d4af37]"
              style={{ animation: 'lbCornerIn 0.4s ease-out 0.36s both' }}
            >
              <div className="absolute bottom-0 left-0 -translate-x-1/2 translate-y-1/2 w-[5px] h-[5px] rotate-45 bg-[#d4af37]" />
            </div>
          </div>

          {/* Traveling glint — keyed on index so it re-fires on prev/next */}
          <div
            key={index}
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 overflow-hidden rounded-sm"
          >
            <div
              className="lb-glint absolute top-0 left-0 h-full w-[18%]"
              style={{
                background: 'linear-gradient(90deg, transparent 0%, rgba(255,236,180,0.45) 50%, transparent 100%)',
                animation: 'lbGlintSweep 7s ease-in-out infinite',
              }}
            />
          </div>

          {/* Crest medallion — straddles the top border, outside the glint clip */}
          <div
            aria-hidden="true"
            className="lb-crest pointer-events-none absolute w-7 h-7 rounded-full bg-[#2c1d11] border-2 border-[#d6b772] flex items-center justify-center"
            style={{
              top: '-14px',
              left: '50%',
              transform: 'translateX(-50%)',
              boxShadow: 'inset 0 0 0 1px rgba(214,183,114,0.4), 0 2px 8px rgba(0,0,0,0.5)',
              animation: 'lbCrestSeal 0.3s cubic-bezier(0.22, 1, 0.36, 1) 0.8s both',
            }}
          >
            <Glasses size={14} color="#d6b772" strokeWidth={2} />
          </div>

          {/* Flanking sparkles — offset twinkle loop */}
          <Sparkle
            aria-hidden="true"
            className="lb-sparkle pointer-events-none absolute"
            size={10}
            color="#d6b772"
            style={{ top: '-6px', left: 'calc(50% - 44px)', opacity: 0.6, animation: 'lbSparkleTwinkle 3s ease-in-out 1s infinite' }}
          />
          <Sparkle
            aria-hidden="true"
            className="lb-sparkle pointer-events-none absolute"
            size={10}
            color="#d6b772"
            style={{ top: '-6px', left: 'calc(50% + 44px)', opacity: 0.6, animation: 'lbSparkleTwinkle 3s ease-in-out 1.5s infinite' }}
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
