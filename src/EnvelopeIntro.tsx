import { useState, useRef, useEffect, type KeyboardEvent } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import AnimatedShaderBackground from '@/src/components/ui/animated-shader-background';
import { buildBlobUrl } from './azure';

const hogwartsLogo = buildBlobUrl('static/Hogwarts_logo.jpg');

interface EnvelopeIntroProps {
  onOpen: () => void;
  onFinish: () => void;
}

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

    const d = prefersReducedMotion ? 0.1 : 1;
    setStage(1);
    const t1 = setTimeout(() => setStage(2), 500 * d);
    const t2 = setTimeout(() => setStage(3), 1300 * d);
    const t3 = setTimeout(finish, 2700 * d);
    timeoutIds.current = [t1, t2, t3];
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
      transition={{ duration: 0.6, ease: 'easeInOut' }}
    >
      <AnimatedShaderBackground
        paused={!!prefersReducedMotion}
        className="absolute inset-0 w-full h-full"
      />

      {/* Candle-glow bars */}
      <div className="absolute top-20 right-40 flex-col gap-8 pointer-events-none hidden md:flex">
        <div className="w-2 h-16 bg-gradient-to-b from-transparent via-yellow-200/40 to-yellow-500/60 rounded-full blur-[2px]" />
        <div className="w-2 h-24 bg-gradient-to-b from-transparent via-yellow-200/40 to-yellow-500/60 rounded-full blur-[2px] ml-12" />
      </div>

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
          initial={{ opacity: 0, scale: 0.8, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 1.1, filter: 'blur(8px)' }}
          whileTap={{ scale: 0.97 }}
          transition={{ duration: prefersReducedMotion ? 0.1 : 0.8, ease: 'easeInOut' }}
          style={{ transformStyle: 'preserve-3d' }}
        >
          {stage === 0 && (
            <div className="absolute -bottom-12 left-1/2 -translate-x-1/2 text-white/70 text-[10px] uppercase tracking-[0.4em] font-light w-max select-none">
              Premi per aprire
            </div>
          )}

          {/* Envelope back */}
          <div className="absolute inset-0 envelope-surface shadow-[0_50px_100px_-20px_rgba(0,0,0,0.8)] rounded-sm z-10 border-4 border-[#ede4cc]" />

          {/* Mini letter */}
          <motion.div
            className="absolute left-[5%] right-[5%] top-[5%] bottom-[5%] paper-surface flex flex-col items-center p-4"
            style={{ zIndex: stage >= 3 ? 35 : 20, borderWidth: '2px', borderColor: '#ede4cc' }}
            animate={{ y: stage >= 3 ? -200 : 0 }}
            transition={{ type: 'spring', damping: 20, stiffness: 100 }}
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
            transition={{ type: 'spring', damping: 18, stiffness: 120 }}
          >
            <div className="absolute inset-0 envelope-surface" style={{ clipPath: 'polygon(0 0, 50% 55%, 100% 0)' }} />
          </motion.div>

          {/* Wax seal */}
          <motion.div
            className="absolute left-1/2 -translate-x-1/2 top-[52%] -translate-y-1/2 z-50 w-16 h-16 sm:w-20 sm:h-20 wax-seal rounded-full flex items-center justify-center"
            animate={{ scale: stage >= 1 ? 1.5 : 1, opacity: stage >= 1 ? 0 : 1 }}
            transition={{ duration: prefersReducedMotion ? 0.05 : 0.4 }}
            aria-hidden="true"
          >
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
