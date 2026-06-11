import { useState, useRef, useEffect, type KeyboardEvent } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import AnimatedShaderBackground from '@/src/components/ui/animated-shader-background';
import { buildBlobUrl } from './azure';

const hogwartsLogo = buildBlobUrl('static/Hogwarts_logo.jpg');

interface EnvelopeIntroProps {
  onOpen: () => void;
  onFinish: () => void;
}

// Stages:
// 0 — idle (envelope closed, seal glows)
// 1 — seal breaks (fades with blur)
// 2 — flap springs open
// 3 — letter rises and scales toward viewer
// 4 — envelope recedes; letter is alone
// 5 — done (calls onFinish)

export default function EnvelopeIntro({ onOpen, onFinish }: EnvelopeIntroProps) {
  const [stage, setStage] = useState(0);
  const prefersReducedMotion = useReducedMotion();
  const timeoutIds = useRef<ReturnType<typeof setTimeout>[]>([]);

  const finish = () => {
    timeoutIds.current.forEach(clearTimeout);
    onFinish();
  };

  useEffect(() => {
    const handler = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') finish();
    };
    window.addEventListener('keydown', handler);
    return () => {
      window.removeEventListener('keydown', handler);
      timeoutIds.current.forEach(clearTimeout);
    };
  }, []);

  const handleOpen = () => {
    if (stage > 0) return;
    onOpen();

    if (prefersReducedMotion) {
      finish();
      return;
    }

    setStage(1);                                          // seal breaks
    const t1 = setTimeout(() => setStage(2), 250);       // flap opens (overlaps seal fade)
    const t2 = setTimeout(() => setStage(3), 700);       // letter rises + scales
    const t3 = setTimeout(() => setStage(4), 1050);      // envelope recedes
    const t4 = setTimeout(finish, 1800);                 // handoff to page
    timeoutIds.current = [t1, t2, t3, t4];
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleOpen();
    }
  };

  return (
    <motion.div
      className="fixed inset-0 z-[150] grid place-items-center overflow-hidden"
      style={{ background: 'radial-gradient(circle at center, #1a1c25 0%, #0c0d12 100%)' }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.55, ease: 'easeInOut' }}
    >
      <AnimatedShaderBackground
        paused={!!prefersReducedMotion}
        className="absolute inset-0 w-full h-full"
      />

      {/* Star-field dots */}
      <div
        className="absolute inset-0 opacity-[0.07] pointer-events-none"
        style={{ backgroundImage: 'radial-gradient(#ffffff 1px, transparent 1px)', backgroundSize: '40px 40px' }}
      />

      <AnimatePresence>
        <motion.div
          className="relative w-[340px] h-[240px] sm:w-[480px] sm:h-[320px] cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-[#d4af37] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0c0d12] rounded-sm"
          onClick={handleOpen}
          onKeyDown={handleKeyDown}
          role="button"
          tabIndex={0}
          aria-label="Apri l'invito"
          initial={{ opacity: 0, scale: 0.85, y: 24 }}
          animate={
            stage >= 4
              ? { opacity: 0, scale: 0.9, y: 40, filter: 'blur(6px)' }
              : { opacity: 1, scale: 1, y: 0, filter: 'blur(0px)' }
          }
          transition={
            stage >= 4
              ? { duration: 0.45, ease: 'easeIn' }
              : { duration: 0.8, ease: [0.22, 1, 0.36, 1] }
          }
          style={{ transformStyle: 'preserve-3d' }}
        >
          {/* Idle float animation */}
          <motion.div
            className="absolute inset-0"
            animate={stage === 0 ? { y: [0, -6, 0] } : { y: 0 }}
            transition={{ duration: 4, ease: 'easeInOut', repeat: Infinity, repeatType: 'loop' }}
          />

          {stage === 0 && (
            <div className="absolute -bottom-12 left-1/2 -translate-x-1/2 text-white/70 text-[10px] uppercase tracking-[0.4em] font-light w-max select-none">
              Premi per aprire
            </div>
          )}

          {/* Envelope back */}
          <div className="absolute inset-0 envelope-surface shadow-[0_50px_100px_-20px_rgba(0,0,0,0.8)] rounded-sm z-10 border-4 border-[#ede4cc]" />

          {/* Mini letter — rises and scales toward viewer */}
          <motion.div
            className="absolute left-[5%] right-[5%] top-[5%] bottom-[5%] paper-surface flex flex-col items-center p-4"
            style={{ zIndex: stage >= 3 ? 35 : 20, borderWidth: '2px', borderColor: '#ede4cc', transformOrigin: 'center center' }}
            animate={
              stage >= 3
                ? { y: -220, scale: 2.4, opacity: stage >= 4 ? 0 : 1, filter: stage >= 4 ? 'blur(4px)' : 'blur(0px)' }
                : { y: 0, scale: 1, opacity: 1, filter: 'blur(0px)' }
            }
            transition={{ type: 'spring', damping: 22, stiffness: 110 }}
          >
            <img src={hogwartsLogo} alt="" className="w-12 sm:w-16 h-auto mb-2 mt-2 object-contain mix-blend-multiply opacity-80" aria-hidden="true" />
            <div className="w-[80%] h-[2px] bg-[#1a4a2e]/20 mt-2 mb-2" />
            <div className="w-[60%] h-[2px] bg-[#1a4a2e]/20" />
          </motion.div>

          {/* Left flap */}
          <div className="absolute inset-0 z-30 pointer-events-none" style={{ filter: 'drop-shadow(3px 0 4px rgba(0,0,0,0.25))' }}>
            <div className="absolute inset-0 envelope-surface" style={{ clipPath: 'polygon(0 0, 42% 50%, 0 100%)' }} />
          </div>

          {/* Right flap */}
          <div className="absolute inset-0 z-30 pointer-events-none" style={{ filter: 'drop-shadow(-3px 0 4px rgba(0,0,0,0.25))' }}>
            <div className="absolute inset-0 envelope-surface" style={{ clipPath: 'polygon(100% 0, 58% 50%, 100% 100%)' }} />
          </div>

          {/* Bottom flap */}
          <div className="absolute inset-0 z-30 pointer-events-none" style={{ filter: 'drop-shadow(0 -3px 4px rgba(0,0,0,0.2))' }}>
            <div className="absolute inset-0 envelope-surface" style={{ clipPath: 'polygon(0 100%, 50% 48%, 100% 100%)' }} />
          </div>

          {/* Top flap */}
          <motion.div
            className="absolute inset-0 z-40 pointer-events-none origin-top"
            style={{ filter: stage < 2 ? 'drop-shadow(0 4px 6px rgba(0,0,0,0.4))' : 'none' }}
            animate={{ rotateX: stage >= 2 ? -180 : 0, zIndex: stage >= 2 ? 15 : 40 }}
            transition={{ type: 'spring', damping: 16, stiffness: 140 }}
          >
            <div className="absolute inset-0 envelope-surface" style={{ clipPath: 'polygon(0 0, 50% 55%, 100% 0)' }} />
          </motion.div>

          {/* Wax seal */}
          <motion.div
            className="absolute left-1/2 -translate-x-1/2 top-[52%] -translate-y-1/2 z-50 w-16 h-16 sm:w-20 sm:h-20 wax-seal rounded-full flex items-center justify-center"
            animate={
              stage >= 1
                ? { scale: 1.3, opacity: 0, filter: 'blur(4px)', rotate: 12 }
                : { scale: 1, opacity: 1, filter: 'blur(0px)', rotate: 0 }
            }
            transition={{ type: 'spring', damping: 18, stiffness: 200 }}
            aria-hidden="true"
          >
            {/* Idle glow pulse */}
            <motion.div
              className="absolute inset-0 rounded-full bg-[#8b1a1a]"
              animate={stage === 0 ? { opacity: [0.4, 0.7, 0.4], scale: [1, 1.08, 1] } : { opacity: 0 }}
              transition={{ duration: 2.5, ease: 'easeInOut', repeat: Infinity, repeatType: 'loop' }}
            />
            <div className="absolute inset-0 bg-[#8b1a1a] rounded-full blur-[1px] opacity-50" />
            <img src={hogwartsLogo} alt="" className="relative z-10 w-[60px] h-[60px] sm:w-[80px] sm:h-[80px] object-contain mix-blend-multiply opacity-50 saturate-0" />
          </motion.div>
        </motion.div>
      </AnimatePresence>

      {/* Skip affordance */}
      <button
        type="button"
        onClick={finish}
        className="absolute bottom-8 right-6 sm:right-10 font-cinzel text-[0.65rem] uppercase tracking-[0.3em] text-white/40 hover:text-white/70 transition-colors pb-[env(safe-area-inset-bottom,0px)]"
        aria-label="Salta l'introduzione"
      >
        Salta →
      </button>
    </motion.div>
  );
}
