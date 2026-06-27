import { useState, useRef, useEffect, lazy, Suspense, type MouseEvent, type ReactNode } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import { Send, Volume2, VolumeX, X, Copy, Check, Camera, Moon, Sun, Download, MapPin, Train, Loader2 } from 'lucide-react';
import EnvelopeIntro from './EnvelopeIntro';
import PhotoAlbum from './PhotoAlbum';
import RsvpModal from './RsvpModal';
import { buildBlobUrl } from './azure';
import { AnimateNumber } from '@/src/components/ui/animated-blur-number';
import type { Recipient } from './rsvp';
import themeSong from '../assets/harry_potter_theme.mp3';

// Route #admin caricata in lazy: bundle invito resta leggero.
const Dashboard = lazy(() => import('./dashboard/Dashboard'));

const hogwartsLogo   = buildBlobUrl('static/Hogwarts_logo.jpg');
const ticketImage    = buildBlobUrl('static/BigliettoInternoPartecipazione.jpeg');
const dumbledoreSign = buildBlobUrl('static/albus-dumbledore-sign.jpg');

function downloadCalendar() {
  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Nicolas e Giulia//Matrimonio//IT',
    'BEGIN:VEVENT',
    'UID:matrimonio-nicolas-giulia-20260912@nicolasgiulia12settembre26.com',
    'DTSTAMP:20260101T000000Z',
    'DTSTART:20260912T150000Z',
    'DTEND:20260912T230000Z',
    'SUMMARY:Matrimonio di Nicolas \\& Giulia',
    'DESCRIPTION:Cerimonia ore 17:00 alla Biblioteca Sperelliana\\, a seguire ricevimento presso Villa Monte Granelli.',
    'LOCATION:Biblioteca Sperelliana\\, Via di Fonte Avellana\\, Gubbio (PG)',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
  const url = URL.createObjectURL(new Blob([ics], { type: 'text/calendar' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = 'matrimonio-nicolas-giulia.ics';
  a.click();
  URL.revokeObjectURL(url);
}

/* ── Numbered section layout ──────────────────────────────────── */

interface SectionProps {
  number: string;
  id?: string;
  title: string;
  children: ReactNode;
  delay?: number;
}

function Section({ number, id, title, children, delay = 0 }: SectionProps) {
  const reduced = useReducedMotion();
  return (
    <motion.section
      id={id}
      initial={reduced ? false : { opacity: 0, y: 16 }}
      whileInView={reduced ? {} : { opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.6, ease: 'easeOut', delay }}
      className="max-w-2xl mx-auto px-6 sm:px-10 py-14 sm:py-20 flex gap-5 sm:gap-8 items-start"
    >
      <div
        className="shrink-0 mt-1 w-10 h-10 sm:w-11 sm:h-11 rounded-full wax-badge font-cinzel text-base grid place-items-center -rotate-3 select-none"
        aria-hidden="true"
      >
        {number}
      </div>
      <div className="flex-1 min-w-0">
        <h2
          className="font-cinzel font-semibold leading-tight mb-5 flex items-center gap-3"
          style={{ fontSize: 'clamp(1.35rem, 4.5vw, 1.85rem)', color: 'var(--ink)' }}
        >
          {title}
          {!reduced && (
            <motion.span
              initial={{ opacity: 0, scale: 0.5 }}
              whileInView={{ opacity: 0.7, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.3, delay: delay + 0.2 }}
              aria-hidden="true"
              style={{ color: 'var(--gold)', fontSize: '0.6em' }}
            >
              ✦
            </motion.span>
          )}
        </h2>
        {children}
      </div>
    </motion.section>
  );
}

/* ── Gold divider ───────────────────────────────────────────────── */

function Rule() {
  return (
    <div className="max-w-2xl mx-auto px-6 sm:px-10" aria-hidden="true">
      <div className="gold-rule" />
    </div>
  );
}

/* ── Button primitives ──────────────────────────────────────────── */

const btnBase =
  'inline-flex items-center gap-2 px-6 py-3 rounded-[2px] text-[0.88rem] tracking-[0.1em] uppercase transition-all active:translate-y-px font-cinzel';

function PrimaryBtn({ onClick, href, target, rel, children }: {
  onClick?: (e: MouseEvent<HTMLButtonElement | HTMLAnchorElement>) => void;
  href?: string; target?: string; rel?: string; children: ReactNode;
}) {
  const style = { background: 'var(--accent)', color: 'var(--accent-on)' };
  if (href) {
    return (
      <a href={href} target={target} rel={rel} className={btnBase} style={style}
        onClick={onClick as (e: MouseEvent<HTMLAnchorElement>) => void}>
        {children}
      </a>
    );
  }
  return (
    <button type="button" className={btnBase} style={style}
      onClick={onClick as (e: MouseEvent<HTMLButtonElement>) => void}>
      {children}
    </button>
  );
}

function GhostBtn({ onClick, href, target, rel, children }: {
  onClick?: (e: MouseEvent<HTMLButtonElement | HTMLAnchorElement>) => void;
  href?: string; target?: string; rel?: string; children: ReactNode;
}) {
  const style = { borderColor: 'color-mix(in srgb, var(--gold) 55%, transparent)', color: 'var(--ink)' };
  if (href) {
    return (
      <a href={href} target={target} rel={rel} className={`${btnBase} border`} style={style}
        onClick={onClick as (e: MouseEvent<HTMLAnchorElement>) => void}>
        {children}
      </a>
    );
  }
  return (
    <button type="button" className={`${btnBase} border`} style={style}
      onClick={onClick as (e: MouseEvent<HTMLButtonElement>) => void}>
      {children}
    </button>
  );
}

/* ── Main component ─────────────────────────────────────────────── */

export default function App() {
  const audioRef = useRef<HTMLAudioElement>(null);

  const [adminRoute, setAdminRoute] = useState<boolean>(
    () => window.location.hash.toLowerCase() === '#admin',
  );
  const [fotoRoute, setFotoRoute] = useState<boolean>(
    () => window.location.hash.toLowerCase() === '#foto',
  );
  useEffect(() => {
    const handler = () => {
      const hash = window.location.hash.toLowerCase();
      const isAdmin = hash === '#admin';
      const isFoto = hash === '#foto';
      setAdminRoute(isAdmin);
      setFotoRoute(isFoto);
      if (isAdmin) window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', handler);
    return () => window.removeEventListener('hashchange', handler);
  }, []);

  // #foto deep-link: used by the wedding QR code so guests land on the upload page in one tap.
  useEffect(() => {
    if (!fotoRoute) return;
    setIntroDone(true);
    setShowAlbum(true);
  }, [fotoRoute]);

  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [hasStartedSong, setHasStartedSong] = useState(false);
  const [showTicket, setShowTicket] = useState(false);
  const [showAlbum, setShowAlbum]   = useState<boolean>(
    () => window.location.hash.toLowerCase() === '#foto',
  );
  const [copiedIban, setCopiedIban] = useState(false);
  const [isDark, setIsDark] = useState(false);
  const [introDone, setIntroDone] = useState<boolean>(
    () => window.location.hash.toLowerCase() === '#foto',
  );
  const [rsvpRecipient, setRsvpRecipient] = useState<Recipient | null>(null);

  if (adminRoute) {
    const exitAdmin = () => {
      window.location.hash = '';
    };
    return (
      <Suspense
        fallback={
          <div className="min-h-screen flex items-center justify-center" style={{ background: '#0c0d12' }}>
            <Loader2 size={28} className="text-[#d4af37] animate-spin" />
          </div>
        }
      >
        <Dashboard onExit={exitAdmin} />
      </Suspense>
    );
  }

  useEffect(() => {
    setIsDark(document.documentElement.dataset.theme === 'dark');
  }, []);

  // Scroll lock while intro is showing
  useEffect(() => {
    document.body.style.overflow = introDone ? '' : 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, [introDone]);

  const startAudio = () => {
    if (audioRef.current && !hasStartedSong) {
      audioRef.current.volume = 0.4;
      audioRef.current.play().catch(() => {});
      setHasStartedSong(true);
      setIsAudioMuted(false);
    }
  };

  const toggleTheme = () => {
    const next = !isDark;
    document.documentElement.dataset.theme = next ? 'dark' : 'light';
    localStorage.setItem('ng-theme', next ? 'dark' : 'light');
    setIsDark(next);
  };

  const toggleAudio = (e: MouseEvent) => {
    e.stopPropagation();
    if (!hasStartedSong && audioRef.current) {
      audioRef.current.volume = 0.3;
      audioRef.current.play().catch(() => {});
      setHasStartedSong(true);
      setIsAudioMuted(false);
    } else if (audioRef.current) {
      audioRef.current.muted = !isAudioMuted;
      setIsAudioMuted(!isAudioMuted);
    }
  };

  const copyIban = (e: MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText('IT38C0366901600571666986706');
    setCopiedIban(true);
    setTimeout(() => setCopiedIban(false), 2000);
  };

  // Countdown
  const WEDDING = new Date('2026-09-12T17:00:00+02:00').getTime();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const timeLeft    = Math.max(0, WEDDING - now);
  const daysLeft    = Math.floor(timeLeft / 86_400_000);
  const hoursLeft   = Math.floor((timeLeft % 86_400_000) / 3_600_000);
  const minutesLeft = Math.floor((timeLeft % 3_600_000) / 60_000);

  return (
    <div
      className="min-h-screen font-body"
      style={{ background: 'var(--bg)', color: 'var(--ink)' }}
    >
      <audio ref={audioRef} src={themeSong} />

      {/* Envelope intro gate */}
      <AnimatePresence>
        {!introDone && (
          <EnvelopeIntro onOpen={startAudio} onFinish={() => setIntroDone(true)} />
        )}
      </AnimatePresence>

      {/* Subtle grain texture */}
      <div
        className="fixed inset-0 z-0 pointer-events-none"
        style={{
          opacity: 0.45,
          backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='160' height='160' filter='url(%23n)' opacity='0.035'/%3E%3C/svg%3E\")",
        }}
      />

      {/* Page content — fades in after intro */}
      <motion.div
        animate={{ opacity: introDone ? 1 : 0, scale: introDone ? 1 : 0.96 }}
        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        inert={!introDone || undefined}
      >
        {/* Skip link */}
        <a
          href="#contenuto"
          className="fixed -top-14 left-4 focus:top-3 z-[200] px-4 py-2 text-sm transition-[top] duration-200 rounded-[2px] font-cinzel"
          style={{ background: 'var(--accent)', color: 'var(--accent-on)' }}
        >
          Vai al contenuto
        </a>

        {/* ── Header ─────────────────────────────────────────────── */}
        <header
          className="sticky top-0 z-50 flex items-center gap-3 px-6 sm:px-10 h-[3.75rem] border-b"
          style={{
            background: 'color-mix(in srgb, var(--bg) 86%, transparent)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            borderColor: 'var(--rule)',
          }}
        >
          <a
            href="#"
            className="font-cinzel font-semibold text-[1.05rem] tracking-wide mr-auto"
            style={{ color: 'var(--ink)' }}
            aria-label="Torna all'inizio"
          >
            N<span style={{ color: 'var(--gold)' }}>·</span>G
          </a>

          <nav aria-label="Sezioni della pagina" className="hidden sm:flex items-center gap-5">
            {[
              { id: 'cerimonia', label: 'Cerimonia' },
              { id: 'rsvp',      label: 'RSVP' },
              { id: 'regalo',    label: 'Regalo' },
              { id: 'album',     label: 'Album' },
            ].map(({ id, label }) => (
              <a
                key={id}
                href={`#${id}`}
                className="font-cinzel text-[0.78rem] tracking-[0.14em] uppercase transition-colors hover:opacity-100"
                style={{ color: 'var(--ink-muted)' }}
              >
                {label}
              </a>
            ))}
          </nav>

          {/* Audio toggle */}
          <button
            type="button"
            onClick={toggleAudio}
            className="w-9 h-9 rounded-full border grid place-items-center transition-colors"
            style={{ borderColor: 'var(--rule)', color: 'var(--ink-muted)' }}
            aria-label={!hasStartedSong ? 'Avvia musica' : isAudioMuted ? 'Riattiva musica' : 'Silenzia musica'}
          >
            {(!hasStartedSong || isAudioMuted) ? <VolumeX size={15} /> : <Volume2 size={15} />}
          </button>

          {/* Theme toggle */}
          <button
            type="button"
            onClick={toggleTheme}
            className="w-9 h-9 rounded-full border grid place-items-center transition-colors"
            style={{ borderColor: 'var(--rule)', color: 'var(--ink-muted)' }}
            aria-label={isDark ? 'Passa al tema chiaro' : 'Passa al tema scuro'}
            aria-pressed={isDark}
          >
            {isDark ? <Sun size={15} /> : <Moon size={15} />}
          </button>
        </header>

        <div className="letter-sheet mx-3 sm:mx-auto max-w-3xl sm:mt-8 sm:mb-12 mt-4 mb-8 rounded-[3px] overflow-hidden">
        <main id="contenuto">

          {/* ── Hero ─────────────────────────────────────────────── */}
          <section className="max-w-2xl mx-auto px-6 sm:px-10 pt-20 pb-16 sm:pt-28 sm:pb-24 text-center" style={{ paddingTop: '50px' }}>
            <img
              src={hogwartsLogo}
              alt=""
              aria-hidden="true"
              className="w-35 h-35 mx-auto mb-5 object-contain"
              style={{ mixBlendMode: isDark ? 'normal' : 'multiply', opacity: isDark ? 0.6 : 0.8 }}
            />
            <p
              className="font-cinzel text-[0.78rem] tracking-[0.28em] uppercase mb-8"
              style={{ color: 'var(--accent)' }}
            >
              Sabato 12 settembre 2026 · Gubbio
            </p>

            <h1
              className="font-script font-normal leading-[1.02] mb-7"
              style={{ fontSize: 'clamp(3.8rem, 15vw, 7rem)', color: 'var(--ink)' }}
            >
              <span className="block">Nicolas</span>
              <span
                className="block font-script"
                style={{ fontSize: '0.45em', color: 'var(--gold)', margin: '0.2em 0' }}
                aria-hidden="true"
              >
                &amp;
              </span>
              <span className="block">Giulia</span>
            </h1>

            <p className="font-body mb-10 text-lg leading-relaxed" style={{ color: 'var(--ink-muted)' }}>
              Abbiamo il piacere di invitarvi al nostro matrimonio.{' '}
              <br className="hidden sm:block" />
              <em style={{ color: 'var(--ink)' }}>Biblioteca Sperelliana, ore 17:00 — Gubbio (PG)</em>
            </p>

            {/* Countdown */}
            <div role="timer" aria-label="Tempo rimanente al matrimonio" className="mb-10">
              <p
                className="font-cinzel text-[0.78rem] tracking-[0.22em] uppercase mb-3"
                style={{ color: 'var(--ink-muted)' }}
              >
                Mancano al fatidico sì
              </p>
              <div className="flex items-baseline justify-center gap-1 sm:gap-2 flex-wrap">
                <AnimateNumber
                  value={daysLeft}
                  duration={600}
                  blur={16}
                  className="font-cinzel font-light tabular-nums"
                  style={{ fontSize: 'clamp(3rem, 10vw, 5rem)', color: 'var(--accent)' }}
                />
                <span className="font-cinzel text-sm mb-1" style={{ color: 'var(--ink-muted)' }}>giorni</span>
                <span className="mx-1 font-cinzel font-light text-2xl" style={{ color: 'var(--rule)' }}>·</span>
                <AnimateNumber
                  value={hoursLeft}
                  duration={600}
                  blur={16}
                  className="font-cinzel font-light tabular-nums text-3xl sm:text-4xl"
                  style={{ color: 'var(--ink)' }}
                />
                <span className="font-cinzel text-sm" style={{ color: 'var(--ink-muted)' }}>ore</span>
                <span className="mx-1 font-cinzel font-light text-xl" style={{ color: 'var(--rule)' }}>·</span>
                <AnimateNumber
                  value={minutesLeft}
                  duration={600}
                  blur={16}
                  className="font-cinzel font-light tabular-nums text-3xl sm:text-4xl"
                  style={{ color: 'var(--ink)' }}
                />
                <span className="font-cinzel text-sm" style={{ color: 'var(--ink-muted)' }}>min</span>
              </div>
            </div>

            <div className="flex justify-center">
              <GhostBtn onClick={() => downloadCalendar()}>
                <Download size={15} />
                Aggiungi al calendario
              </GhostBtn>
            </div>
          </section>

          <Rule />

          {/* ── I. La cerimonia ──────────────────────────────────── */}
          <Section number="I" id="cerimonia" title="La cerimonia">
            <p className="font-semibold mb-1" style={{ color: 'var(--ink)' }}>
              Sabato 12 settembre 2026 · ore 17:00
            </p>
            <p className="mb-5 leading-relaxed" style={{ color: 'var(--ink-muted)' }}>
              Biblioteca Sperelliana<br />
              Complesso Monumentale di San Pietro<br />
              Via di Fonte Avellana, Gubbio (PG)
            </p>
            <a
              href="https://maps.google.com/?q=Biblioteca+Sperelliana,+Via+di+Fonte+Avellana,+Gubbio+PG"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm border-b pb-0.5 transition-colors font-cinzel"
              style={{ color: 'var(--accent)', borderColor: 'color-mix(in srgb, var(--accent) 35%, transparent)' }}
            >
              <MapPin size={13} />
              Apri in Google Maps ↗
            </a>
          </Section>

          <Rule />

          {/* ── II. Il ricevimento ───────────────────────────────── */}
          <Section number="II" id="ricevimento" title="Il ricevimento" delay={0.05}>
            <p className="font-semibold mb-1" style={{ color: 'var(--ink)' }}>
              A seguire la cerimonia
            </p>
            <p className="mb-5 leading-relaxed" style={{ color: 'var(--ink-muted)' }}>
              Ristorante Villa Montegranelli<br />
              Località Spaccio Monteluiano<br />
              06024 Gubbio (PG)
            </p>
            <a
              href="https://maps.google.com/?q=Villa+Monte+Granelli,+Gubbio+PG"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm border-b pb-0.5 transition-colors font-cinzel"
              style={{ color: 'var(--accent)', borderColor: 'color-mix(in srgb, var(--accent) 35%, transparent)' }}
            >
              <MapPin size={13} />
              Apri in Google Maps ↗
            </a>
          </Section>

          <Rule />

          {/* ── III. Invia il gufo (RSVP) ────────────────────────── */}
          <Section number="III" id="rsvp" title="Invia il gufo" delay={0.05}>
            <p className="mb-6 leading-relaxed" style={{ color: 'var(--ink-muted)' }}>
              È gradita gentile conferma{' '}
              <strong style={{ color: 'var(--ink)' }}>entro il 12 agosto 2026</strong>.{' '}
              Un messaggio su WhatsApp vale quanto un gufo postale — e arriva prima.
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <PrimaryBtn onClick={() => setRsvpRecipient('nicolas')}>
                <Send size={14} />
                Nicolas · 331 958 1921
              </PrimaryBtn>
              <GhostBtn onClick={() => setRsvpRecipient('giulia')}>
                <Send size={14} />
                Giulia · 366 204 1886
              </GhostBtn>
            </div>
          </Section>

          <Rule />

          {/* ── IV. Partecipa alla magia (regalo) ───────────────── */}
          <Section number="IV" id="regalo" title="Partecipa alla magia" delay={0.05}>
            <p className="mb-6 leading-relaxed" style={{ color: 'var(--ink-muted)' }}>
              La vostra presenza è il regalo più grande. Se desiderate contribuire
              al nostro viaggio di nozze, questo è il binario giusto.
            </p>
            <GhostBtn onClick={(e) => { e.stopPropagation(); setShowTicket(true); }}>
              <Train size={14} />
              Vedi il biglietto
            </GhostBtn>
          </Section>

          <Rule />

          {/* ── V. Album della magia ────────────────────────────── */}
          <Section number="V" id="album" title="L'album della magia" delay={0.05}>
            <p className="mb-6 leading-relaxed" style={{ color: 'var(--ink-muted)' }}>
              Durante e dopo la festa, carica le tue foto nell'album condiviso:
              i ricordi più belli sono quelli visti con gli occhi di tutti.
            </p>
            <PrimaryBtn onClick={(e) => { e.stopPropagation(); setShowAlbum(true); }}>
              <Camera size={14} />
              Apri l'album
            </PrimaryBtn>
            <p className="mt-3 text-sm italic" style={{ color: 'var(--ink-muted)' }}>
              Le foto caricate saranno visibili a tutti gli invitati.
            </p>
          </Section>

        </main>

        {/* ── Footer ───────────────────────────────────────────────── */}
        <footer
          className="border-t text-center py-16 px-6"
          style={{ borderColor: 'var(--rule)' }}
        >
          <p className="font-script text-3xl mb-1" style={{ color: 'var(--ink)' }}>
            Nicolas <span style={{ color: 'var(--gold)' }}>&amp;</span> Giulia
          </p>
          <p className="font-cinzel text-sm tracking-[0.25em]" style={{ color: 'var(--ink-muted)' }}>
            12 · 09 · 2026 — Gubbio
          </p>
          <img
            src={dumbledoreSign}
            alt="Firma di Albus Dumbledore"
            className="w-32 mx-auto mt-6"
            style={{ mixBlendMode: isDark ? 'screen' : 'multiply', opacity: isDark ? 0.5 : 0.8 }}
          />
          <p className="mt-4 text-sm italic font-body" style={{ color: 'var(--ink-muted)' }}>
            «Vi aspettiamo. Il gufo è già in volo.»
          </p>
        </footer>
        </div>

        {/* ── Photo album overlay ───────────────────────────────────── */}
        <AnimatePresence>
          {showAlbum && (
            <PhotoAlbum
              onClose={() => {
                setShowAlbum(false);
                // Exiting from the #foto deep-link: clear the hash so guests
                // land on the normal invitation page instead of a dead route.
                if (fotoRoute) window.location.hash = '';
              }}
            />
          )}
        </AnimatePresence>

        {/* ── Ticket / gift modal ───────────────────────────────────── */}
        <AnimatePresence mode="wait">
          {showTicket && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[200] flex items-center justify-center p-4 sm:p-8 overflow-y-auto pt-16 pb-10"
              style={{ background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(4px)' }}
              onClick={() => setShowTicket(false)}
              role="dialog"
              aria-modal="true"
              aria-label="Biglietto lista nozze"
            >
              <motion.div
                initial={{ scale: 0.96, y: 12 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.96, y: 12 }}
                transition={{ type: 'spring', damping: 30, stiffness: 300 }}
                className="relative w-full max-w-3xl mx-auto my-auto"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  autoFocus
                  type="button"
                  onClick={() => setShowTicket(false)}
                  className="absolute -top-4 -right-4 w-9 h-9 rounded-full border-2 grid place-items-center z-10 transition-transform hover:scale-110"
                  style={{ background: '#2c1d11', color: '#d6b772', borderColor: '#d6b772' }}
                  aria-label="Chiudi"
                >
                  <X size={16} />
                </button>

                <div
                  className="rounded-[2px] overflow-hidden border shadow-[0_20px_50px_rgba(0,0,0,0.6)]"
                  style={{ background: '#fdfaf1', borderColor: 'rgba(44,29,17,0.35)' }}
                >
                  <img
                    src={ticketImage}
                    alt="Biglietto Hogwarts Express con lista nozze"
                    className="w-full h-auto"
                  />
                  <div
                    className="p-5 border-t flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
                    style={{ borderColor: 'rgba(44,29,17,0.15)', background: 'rgba(255,255,255,0.5)' }}
                  >
                    <p className="font-mono text-sm break-all" style={{ color: '#2c1d11' }}>
                      IBAN: IT38 C036 6901 6005 7166 6986 706
                    </p>
                    <button
                      type="button"
                      onClick={copyIban}
                      className={`${btnBase} shrink-0`}
                      style={{ background: '#1a4a2e', color: '#fdfaf1' }}
                    >
                      {copiedIban
                        ? <Check size={14} style={{ color: '#d4af37' }} />
                        : <Copy size={14} style={{ color: '#d4af37' }} />}
                      {copiedIban ? 'Copiato' : 'Copia IBAN'}
                    </button>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── RSVP modal ────────────────────────────────────────────── */}
        <AnimatePresence>
          {rsvpRecipient && (
            <RsvpModal
              recipient={rsvpRecipient}
              onClose={() => setRsvpRecipient(null)}
            />
          )}
        </AnimatePresence>

      </motion.div>
    </div>
  );
}
