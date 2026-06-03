/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useRef, type MouseEvent } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, Send, Volume2, VolumeX, ArrowLeft, Star as StarIcon, Train, X, Copy, Check } from 'lucide-react';
import hogwartsLogo from '../assets/Hogwarts_logo.jpg';
import themeSong from '../assets/harry_potter_theme.mp3';
import ticketImage from '../assets/BigliettoInternoPartecipazione.jpeg';
import dumbledoreSign from '../assets/albus-dumbledore-sign.jpg';

export default function App() {
  const [stage, setStage] = useState(0);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [hasStartedSong, setHasStartedSong] = useState(false);
  const [showTicket, setShowTicket] = useState(false);
  const [copiedIban, setCopiedIban] = useState(false);

  const copyIban = (e: MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText('IT38C0366901600571666986706');
    setCopiedIban(true);
    setTimeout(() => setCopiedIban(false), 2000);
  };

  const handleOpen = () => {
    if (stage > 0) return;
    
    // Play magical background music on interaction
    if (audioRef.current && !hasStartedSong) {
      audioRef.current.volume = 0.4;
      audioRef.current.play().catch(e => console.log('Audio autoplay blocked by browser:', e));
      setHasStartedSong(true);
    }

    setStage(1);
    setTimeout(() => setStage(2), 500);
    setTimeout(() => setStage(3), 1300);
    setTimeout(() => setStage(4), 2200);
  };

  const toggleMute = (e: MouseEvent) => {
    e.stopPropagation();
    if (audioRef.current) {
      audioRef.current.muted = !isAudioMuted;
      setIsAudioMuted(!isAudioMuted);
    }
  };

  return (
    <div className="min-h-screen bg-[#0c0d12] overflow-hidden flex items-center justify-center font-body text-[#1a1a1a] perspective-[1200px] selection:bg-[#1a4a2e] selection:text-[#fdfaf1]" style={{ background: 'radial-gradient(circle at center, #1a1c25 0%, #0c0d12 100%)' }}>
      
      {/* Audio Element */}
      <audio ref={audioRef} src={themeSong} loop />

      {/* Floating Audio Toggle */}
      <AnimatePresence>
        {hasStartedSong && (
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute top-6 right-6 z-[100] p-3 rounded-full bg-[#fdfaf1]/10 text-[#fdfaf1]/60 border border-[#fdfaf1]/20 hover:bg-[#fdfaf1]/20 hover:text-white transition-colors backdrop-blur-sm cursor-pointer"
            onClick={toggleMute}
            aria-label={isAudioMuted ? "Unmute Theme" : "Mute Theme"}
          >
            {isAudioMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
          </motion.button>
        )}
      </AnimatePresence>

      {/* Floating abstract decorative pieces */}
      <div className="absolute top-10 left-10 w-24 h-48 bg-[#fdfaf1] rounded-sm shadow-2xl opacity-10 rotate-[-15deg] border border-white/10 pointer-events-none"></div>
      <div className="absolute bottom-20 right-10 w-32 h-20 bg-[#fdfaf1] rounded-sm shadow-2xl opacity-10 rotate-[10deg] border border-white/10 pointer-events-none"></div>
      <div className="absolute top-20 right-40 flex flex-col gap-8 pointer-events-none hidden md:flex">
        <div className="w-2 h-16 bg-gradient-to-b from-transparent via-yellow-200/40 to-yellow-500/60 rounded-full blur-[2px]"></div>
        <div className="w-2 h-24 bg-gradient-to-b from-transparent via-yellow-200/40 to-yellow-500/60 rounded-full blur-[2px] ml-12"></div>
      </div>
      <div className="absolute top-0 left-0 w-full h-full pointer-events-none opacity-[0.03]" style={{ background: 'linear-gradient(45deg, #000 25%, transparent 25%, transparent 75%, #000 75%, #000), linear-gradient(45deg, #000 25%, transparent 25%, transparent 75%, #000 75%, #000)', backgroundSize: '2px 2px' }}></div>

      {/* Mystical particles background (CSS-based) - optional */}
      <div className="absolute inset-0 opacity-20 pointer-events-none" style={{ backgroundImage: 'radial-gradient(#ffffff 1px, transparent 1px)', backgroundSize: '40px 40px' }} />

      <AnimatePresence>
        {stage < 4 && (
          <motion.div
             className="relative w-[340px] h-[240px] sm:w-[480px] sm:h-[320px] cursor-pointer group"
             onClick={handleOpen}
             initial={{ opacity: 0, scale: 0.8, y: 20 }}
             animate={{ opacity: 1, scale: 1, y: 0 }}
             exit={{ opacity: 0, scale: 1.1, filter: 'blur(10px)' }}
             transition={{ duration: 0.8, ease: "easeInOut" }}
             style={{ transformStyle: 'preserve-3d' }}
          >
             {/* Hover instructions */}
             {stage === 0 && (
                <div className="absolute -bottom-12 left-1/2 -translate-x-1/2 text-white/40 text-[10px] uppercase tracking-[0.4em] font-light w-max">
                  Premi per aprire
                </div>
             )}

             {/* Envelope Back Base */}
             <div className="absolute inset-0 envelope-surface shadow-[0_50px_100px_-20px_rgba(0,0,0,0.8)] rounded-sm z-10 border-4 border-[#ede4cc]"></div>

             {/* Mini Letter (slides out) */}
             <motion.div
                className="absolute left-[5%] right-[5%] top-[5%] bottom-[5%] paper-surface flex flex-col items-center p-4 transition-all"
                style={{ zIndex: stage >= 3 ? 35 : 20, borderWidth: '2px', borderColor: '#ede4cc' }}
                initial={{ y: 0 }}
                animate={{ y: stage >= 3 ? -200 : 0 }}
                transition={{ duration: 0.9, type: "spring", bounce: 0.2 }}
             >
                <img src={hogwartsLogo} alt="Hogwarts" className="w-12 sm:w-16 h-auto mb-2 mt-2 object-contain mix-blend-multiply opacity-80" />
                <div className="w-[80%] h-[2px] bg-[#1a4a2e]/20 mt-2 mb-2"></div>
                <div className="w-[60%] h-[2px] bg-[#1a4a2e]/20"></div>
             </motion.div>

             {/* Left Flap */}
             <div className="absolute inset-0 z-30 pointer-events-none" style={{ filter: 'drop-shadow(3px 0 4px rgba(0,0,0,0.25))' }}>
                <div className="absolute inset-0 envelope-surface" style={{ clipPath: 'polygon(0 0, 42% 50%, 0 100%)', borderWidth: '4px', borderColor: 'transparent' }} />
             </div>

             {/* Right Flap */}
             <div className="absolute inset-0 z-30 pointer-events-none" style={{ filter: 'drop-shadow(-3px 0 4px rgba(0,0,0,0.25))' }}>
                <div className="absolute inset-0 envelope-surface" style={{ clipPath: 'polygon(100% 0, 58% 50%, 100% 100%)', borderWidth: '4px', borderColor: 'transparent' }} />
             </div>

             {/* Bottom Flap */}
             <div className="absolute inset-0 z-30 pointer-events-none" style={{ filter: 'drop-shadow(0 -3px 4px rgba(0,0,0,0.2))' }}>
                <div className="absolute inset-0 envelope-surface" style={{ clipPath: 'polygon(0 100%, 50% 48%, 100% 100%)', borderWidth: '4px', borderColor: 'transparent' }} />
             </div>

             {/* Top Flap */}
             <motion.div
                className="absolute inset-0 z-40 pointer-events-none origin-top"
                style={{ filter: stage < 2 ? 'drop-shadow(0 4px 6px rgba(0,0,0,0.4))' : 'none' }}
                initial={{ rotateX: 0 }}
                animate={{ rotateX: stage >= 2 ? -180 : 0, zIndex: stage >= 2 ? 15 : 40 }}
                transition={{ duration: 0.6, ease: "easeInOut" }}
             >
                <div className="absolute inset-0 envelope-surface" style={{ clipPath: 'polygon(0 0, 50% 55%, 100% 0)', borderWidth: '4px', borderColor: 'transparent' }} />
             </motion.div>

             {/* Wax Seal */}
             <motion.div
                className="absolute left-1/2 -translate-x-1/2 top-[52%] -translate-y-1/2 z-50 w-16 h-16 sm:w-20 sm:h-20 wax-seal rounded-full flex flex-col items-center justify-center text-white"
                initial={{ scale: 1, opacity: 1 }}
                animate={{ scale: stage >= 1 ? 1.5 : 1, opacity: stage >= 1 ? 0 : 1 }}
                transition={{ duration: 0.4 }}
             >
                <div className="absolute inset-0 bg-[#8b1a1a] rounded-full blur-[1px] opacity-50 z-0"></div>
                <img src={hogwartsLogo} alt="Seal Logo" className="object-contain mix-blend-multiply opacity-50 saturate-0 z-10 relative w-[60px] h-[60px] mb-[9rem] sm:w-[80px] sm:h-[80px] sm:mb-[12rem] pl-[1px]" />
             </motion.div>

          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {stage === 4 && (
          <motion.div
             className="absolute inset-0 md:inset-8 lg:inset-y-12 lg:inset-x-auto lg:w-[800px] paper-surface md:rounded-sm overflow-y-auto text-[#1a4a2e] p-8 sm:p-12 md:p-20 z-50 flex flex-col"
             initial={{ opacity: 0, scale: 0.9, y: 100 }}
             animate={{ opacity: 1, scale: 1, y: 0 }}
             transition={{ duration: 0.8, type: "spring", bounce: 0.2 }}
          >
             {/* Back Button */}
             <button
               onClick={(e) => {
                 e.stopPropagation();
                 setStage(0);
               }}
               className="absolute top-6 left-6 sm:top-10 sm:left-10 flex items-center gap-2 text-[#1a4a2e]/60 hover:text-[#1a4a2e] transition-colors font-cinzel text-xs uppercase tracking-widest z-[100]"
               aria-label="Torna all'inizio"
             >
               <ArrowLeft size={18} />
               <span className="hidden sm:inline">Indietro</span>
             </button>

             {/* Header */}
             <div className="flex flex-col items-center mb-12 shrink-0">
                <img src={hogwartsLogo} alt="Hogwarts Logo" className="w-24 sm:w-32 h-auto mb-6 object-contain mix-blend-multiply" />
                <div className="text-[#1a4a2e] text-center uppercase tracking-[0.3em] font-bold text-xs sm:text-sm font-cinzel">
                  <p>Hogwarts School of Witchcraft and Wizardry</p>
                  <p className="mt-1 opacity-60 text-[10px]">Preside: Albus Dumbledore</p>
                </div>
             </div>

             {/* Body */}
             <div className="font-body text-base sm:text-lg leading-relaxed text-center space-y-6 flex-grow -mt-4">
                <p className="text-lg">hanno il piacere di invitarvi al loro matrimonio</p>
                
                <h2 className="font-script text-5xl sm:text-[80px] leading-tight font-bold my-6 text-[#1a4a2e]">
                  Nicolas Gentilucci<br/>
                  <span className="text-4xl sm:text-6xl">e</span> Giulia Cro
                </h2>
                
                <div className="max-w-2xl mx-auto space-y-6 border-y border-[#1a4a2e]/20 py-8">
                  <div>
                    <p className="font-body font-bold text-lg">Sabato 12 settembre 2026, ore 17:00</p>
                    <p className="text-sm mt-1">Biblioteca Sperelliana, Complesso Monumentale di San Pietro,<br/>Via di Fonte Avellana, Gubbio (PG)</p>
                  </div>
                  
                  <div className="py-2">
                    <p className="text-sm text-[#1a4a2e]/90">A seguire, saremo felici di festeggiare con voi presso Ristorante Villa<br/>Monte Granelli, Località Spaccio Monteluiviano, 06024 Gubbio (PG)</p>
                  </div>
                </div>

                <div className="pt-4 text-sm opacity-90 space-y-1">
                  <p>È gradita gentile conferma entro il 12/08/2026</p>
                  <p className="font-bold tracking-wide">331 958 1921 — 366 204 1886</p>
                </div>
             </div>

             {/* Footer */}
             <div className="mt-12 pt-8 flex flex-col items-center sm:items-start w-full shrink-0">
                <div className="text-center sm:text-left flex flex-col items-center sm:items-start gap-1">
                  <img src={dumbledoreSign} alt="Albus Dumbledore Signature" className="w-32 sm:w-40 mix-blend-multiply opacity-80" />
                  <p className="font-body text-sm opacity-80">Il Direttore Albus Dumbledore</p>
                </div>
             </div>

             {/* Call to action (RSVP & Gifts) */}
             <div className="mt-16 w-full flex flex-col md:flex-row items-center justify-center gap-6 pb-8 shrink-0">
               <button onClick={(e) => { e.stopPropagation(); setShowTicket(true); }} className="flex items-center gap-3 px-10 py-4 bg-[#8b1a1a] border-[3px] border-double border-[#d4af37] shadow-[0_5px_15px_rgba(139,26,26,0.4)] text-[#fdfaf1] font-cinzel tracking-[0.15em] uppercase hover:bg-[#7a1515] hover:shadow-[0_8px_25px_rgba(139,26,26,0.6)] hover:-translate-y-1 transition-all duration-500 rounded-sm group relative overflow-hidden w-full md:w-auto justify-center">
                 <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg width=\%22100\%22 height=\%22100\%22 viewBox=\%220 0 100 100\%22 xmlns=\%22http://www.w3.org/2000/svg\%22%3E%3Cfilter id=\%22noise\%22%3E%3CfeTurbulence type=\%22fractalNoise\%22 baseFrequency=\%220.8\%22 numOctaves=\%224\%22 stitchTiles=\%22stitch\%22/%3E%3C/filter%3E%3Crect width=\%22100\%22 height=\%22100\%22 filter=\%22url(%23noise)\%22 opacity=\%220.1\%22/%3E%3C/svg%3E')] opacity-30 mix-blend-overlay"></div>
                 <Train size={20} className="text-[#d4af37] transition-transform group-hover:-translate-x-1 relative z-10" />
                 <span className="font-bold relative z-10 text-sm sm:text-base drop-shadow-md">Partecipa Alla Magia</span>
                 <div className="absolute top-1 left-1 right-1 bottom-1 border border-[#d4af37]/30 pointer-events-none"></div>
               </button>

               <a 
                 href="https://wa.me/393319581921?text=Ciao!%20Siamo%20felici%20di%20confermare%20la%20nostra%20presenza%20al%20vostro%20matrimonio."
                 target="_blank"
                 rel="noopener noreferrer"
                 onClick={(e) => e.stopPropagation()}
                 className="flex items-center gap-3 px-10 py-4 bg-[#1a4a2e] border-[3px] border-double border-[#d4af37] shadow-[0_5px_15px_rgba(26,74,46,0.4)] text-[#fdfaf1] font-cinzel tracking-[0.15em] uppercase hover:bg-[#133823] hover:shadow-[0_8px_25px_rgba(26,74,46,0.6)] hover:-translate-y-1 transition-all duration-500 rounded-sm group relative overflow-hidden w-full md:w-auto justify-center"
               >
                 <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg width=\%22100\%22 height=\%22100\%22 viewBox=\%220 0 100 100\%22 xmlns=\%22http://www.w3.org/2000/svg\%22%3E%3Cfilter id=\%22noise\%22%3E%3CfeTurbulence type=\%22fractalNoise\%22 baseFrequency=\%220.8\%22 numOctaves=\%224\%22 stitchTiles=\%22stitch\%22/%3E%3C/filter%3E%3Crect width=\%22100\%22 height=\%22100\%22 filter=\%22url(%23noise)\%22 opacity=\%220.1\%22/%3E%3C/svg%3E')] opacity-30 mix-blend-overlay"></div>
                 <Send size={20} className="text-[#d4af37] transition-transform group-hover:translate-x-1 group-hover:-translate-y-1 relative z-10" />
                 <span className="font-bold relative z-10 text-sm sm:text-base drop-shadow-md">Invia il Gufo</span>
                 <div className="absolute top-1 left-1 right-1 bottom-1 border border-[#d4af37]/30 pointer-events-none"></div>
               </a>
             </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showTicket && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-center justify-center p-4 sm:p-8 bg-black/70 backdrop-blur-sm cursor-pointer overflow-y-auto pt-20 pb-10"
            onClick={(e) => { e.stopPropagation(); setShowTicket(false); }}
          >
            <motion.div
              initial={{ scale: 0.95, y: 15, rotateX: 5 }}
              animate={{ scale: 1, y: 0, rotateX: 0 }}
              exit={{ scale: 0.95, y: 15, rotateX: -5 }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="relative w-full max-w-4xl mx-auto cursor-default perspective-1000 my-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <button 
                onClick={() => setShowTicket(false)} 
                className="absolute -top-3 -right-3 sm:-top-5 sm:-right-5 bg-[#2c1d11] text-[#d6b772] rounded-full p-2 hover:scale-110 transition-transform z-50 shadow-[0_4px_10px_rgba(0,0,0,0.5)] border-2 border-[#d6b772]"
              >
                <X size={20} className="sm:w-6 sm:h-6" />
              </button>
              
              {/* Hogwarts Express Ticket - Gift Registry */}
              <div className="w-full relative bg-[#fdfaf1] text-[#2c1d11] p-4 border border-[#2c1d11]/50 rounded-sm shadow-[0_20px_50px_rgba(0,0,0,0.6)] overflow-hidden flex flex-col gap-4"
                style={{
                  backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)' opacity='0.15'/%3E%3C/svg%3E")`
                }}
              >
                <img 
                  src={ticketImage} 
                  alt="Hogwarts Express Ticket" 
                  className="w-full h-auto object-contain shadow-sm" 
                />
                
                <div className="w-full p-4 border border-[#2c1d11]/20 bg-white/50 flex flex-col sm:flex-row items-center justify-between gap-4 rounded-sm">
                  <div className="text-center sm:text-left overflow-x-auto w-full flex items-center justify-center sm:justify-start">
                    <p className="font-mono text-xs sm:text-sm md:text-base border-b border-[#2c1d11]/20 pb-0.5 whitespace-nowrap overflow-hidden text-ellipsis max-w-full">IBAN: IT38 C036 6901 6005 7166 6986 706</p>
                  </div>
                  <button 
                    onClick={copyIban}
                    className="flex items-center justify-center gap-2 px-6 py-3 bg-[#1a4a2e] text-[#fdfaf1] hover:bg-[#133823] transition-colors rounded-sm uppercase tracking-wider text-xs sm:text-sm font-cinzel shrink-0 w-full sm:w-auto"
                  >
                    {copiedIban ? <Check size={18} className="text-[#d4af37]" /> : <Copy size={18} className="text-[#d4af37]" />}
                    <span>{copiedIban ? 'Copiato' : 'Copia IBAN'}</span>
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
