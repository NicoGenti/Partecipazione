import {
  useState,
  useRef,
  useEffect,
  useCallback,
  type FormEvent,
  type KeyboardEvent,
  type ChangeEvent,
} from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import { X, Send, Loader2, AlertCircle, Check, Feather } from 'lucide-react';
import { saveRsvp } from './azure';
import { getOrCreateDeviceId } from './deviceId';
import {
  buildWhatsAppUrl,
  INTOLERANCE_OPTIONS,
  RSVP_RECIPIENTS,
  validateRsvp,
  type Intolerance,
  type Recipient,
  type RsvpRecord,
} from './rsvp';

interface Props {
  recipient: Recipient;
  onClose: () => void;
}

export default function RsvpModal({ recipient, onClose }: Props) {
  const reduced = useReducedMotion();
  const cardRef = useRef<HTMLDivElement>(null);
  const firstFieldRef = useRef<HTMLInputElement>(null);

  const [fullName, setFullName] = useState('');
  const [adults, setAdults] = useState<number>(1);
  const [bringingChildren, setBringingChildren] = useState(false);
  const [childrenCount, setChildrenCount] = useState<number>(0);
  const [intolerances, setIntolerances] = useState<Intolerance[]>([]);
  const [intolerancesOther, setIntolerancesOther] = useState('');

  const [status, setStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
  const [errors, setErrors] = useState<Partial<Record<keyof RsvpRecord, string>>>({});

  const recipientLabel = RSVP_RECIPIENTS[recipient].label;
  const whatsappUrl = buildWhatsAppUrl(recipient);

  // Focus first field on open; restore focus handled by App via natural React focus.
  useEffect(() => {
    const t = setTimeout(() => firstFieldRef.current?.focus(), 50);
    return () => clearTimeout(t);
  }, []);

  // Escape closes.
  useEffect(() => {
    const handler = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  // Simple focus trap within the modal card.
  useEffect(() => {
    const card = cardRef.current;
    if (!card) return;

    const selector =
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

    const handleTab = (e: globalThis.KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      const nodes = Array.from<HTMLElement>(
        card.querySelectorAll(selector),
      ).filter(
        (n) => !(n as HTMLInputElement).disabled && n.offsetParent !== null,
      );
      if (nodes.length === 0) return;

      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    window.addEventListener('keydown', handleTab);
    return () => window.removeEventListener('keydown', handleTab);
  }, []);

  const toggleIntolerance = useCallback((value: Intolerance) => {
    setIntolerances((prev) =>
      prev.includes(value)
        ? prev.filter((v) => v !== value)
        : [...prev, value],
    );
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (status === 'saving') return;

    const draft = {
      recipient,
      fullName,
      adults,
      bringingChildren,
      childrenCount: bringingChildren ? childrenCount : 0,
      intolerances,
      intolerancesOther: intolerances.includes('other') ? intolerancesOther : '',
      needsRoom: false,
      roomGuests: 0,
      roomLocation: 'Villa Montegranelli' as const,
    };

    const validationErrors = validateRsvp(draft);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      setStatus('idle');
      const firstInvalid = cardRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]');
      firstInvalid?.focus();
      return;
    }

    setErrors({});
    setStatus('saving');

    try {
      const deviceId = getOrCreateDeviceId();
      await saveRsvp({
        ...draft,
        deviceId,
        needsRoom: false,
        roomGuests: 0,
        roomLocation: 'Villa Montegranelli',
        submittedAt: new Date().toISOString(),
      });
      setStatus('success');
    } catch {
      setStatus('error');
    }
  };

  const inputClass = (invalid?: boolean) =>
    `w-full border rounded-sm px-4 py-2.5 font-body text-sm text-[#1a4a2e] placeholder:text-[#1a4a2e]/30 focus:outline-none transition-colors ${
      invalid
        ? 'border-[#8b1a1a] bg-[#8b1a1a]/5 focus:border-[#8b1a1a]'
        : 'border-[#1a4a2e]/30 bg-white/60 focus:border-[#1a4a2e]/60 focus:bg-white/80'
    }`;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: reduced ? 0 : 0.2 }}
      className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="rsvp-title"
    >
      <motion.div
        ref={cardRef}
        initial={{ scale: 0.92, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.92, y: 20 }}
        transition={reduced ? { duration: 0 } : { type: 'spring', damping: 28, stiffness: 280 }}
        className="relative w-full max-w-lg paper-surface rounded-sm p-6 sm:p-10 text-[#1a4a2e] overflow-y-auto max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 text-[#1a4a2e]/50 hover:text-[#1a4a2e] transition-colors"
          aria-label="Chiudi"
        >
          <X size={20} />
        </button>

        {/* Header */}
        <div className="flex flex-col items-center mb-6">
          <div className="w-12 h-12 rounded-full bg-[#1a4a2e] flex items-center justify-center mb-3">
            <Feather size={24} className="text-[#d4af37]" />
          </div>
          <h2
            id="rsvp-title"
            className="font-cinzel text-lg sm:text-xl uppercase tracking-widest text-center font-bold"
          >
            Conferma la tua presenza
          </h2>
          <p className="font-body text-sm text-[#1a4a2e]/70 mt-2 text-center">
            Stai scrivendo a <span className="font-semibold">{recipientLabel}</span>
          </p>
          <div className="w-24 h-px bg-[#d4af37] mt-3" />
        </div>

        {status === 'success' ? (
          <div className="text-center py-4">
            <div className="w-14 h-14 rounded-full bg-[#1a4a2e] flex items-center justify-center mx-auto mb-4">
              <Check size={28} className="text-[#d4af37]" />
            </div>
            <p className="font-cinzel text-base uppercase tracking-widest mb-2">
              Gufo spedito!
            </p>
            <p className="font-body text-sm text-[#1a4a2e]/80 mb-6">
              Le informazioni sono state salvate. Ora apri WhatsApp per confermare con {recipientLabel}.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-[#1a4a2e] border-[3px] border-double border-[#d4af37] text-[#fdfaf1] font-cinzel tracking-[0.15em] uppercase text-sm hover:bg-[#133823] transition-all duration-300 rounded-sm"
              >
                <Send size={14} className="text-[#d4af37]" />
                Apri WhatsApp
              </a>
              <button
                type="button"
                onClick={onClose}
                className="inline-flex items-center justify-center gap-2 px-6 py-3 border border-[#1a4a2e]/30 text-[#1a4a2e] font-cinzel tracking-[0.12em] uppercase text-sm hover:bg-[#1a4a2e]/5 transition-all rounded-sm"
              >
                Chiudi
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5" noValidate>
            {/* Name */}
            <div>
              <label
                htmlFor="rsvp-name"
                className="block font-cinzel text-xs uppercase tracking-widest mb-2 text-[#1a4a2e]/70"
              >
                Nome e cognome <span aria-label="obbligatorio">*</span>
              </label>
              <input
                ref={firstFieldRef}
                id="rsvp-name"
                type="text"
                value={fullName}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setFullName(e.target.value)}
                placeholder="Es. Mario Rossi"
                maxLength={80}
                aria-invalid={!!errors.fullName}
                aria-describedby={errors.fullName ? 'rsvp-name-error' : undefined}
                className={inputClass(!!errors.fullName)}
              />
              <AnimatePresence>
                {errors.fullName && (
                  <motion.p
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    id="rsvp-name-error"
                    className="mt-1.5 text-xs text-[#8b1a1a] font-body"
                  >
                    {errors.fullName}
                  </motion.p>
                )}
              </AnimatePresence>
            </div>

            {/* Adults */}
            <div>
              <label
                htmlFor="rsvp-adults"
                className="block font-cinzel text-xs uppercase tracking-widest mb-2 text-[#1a4a2e]/70"
              >
                In quanti parteciperete? <span aria-label="obbligatorio">*</span>
              </label>
              <input
                id="rsvp-adults"
                type="number"
                min={1}
                max={10}
                value={adults}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setAdults(Number(e.target.value))}
                aria-invalid={!!errors.adults}
                aria-describedby={errors.adults ? 'rsvp-adults-error' : undefined}
                className={`${inputClass(!!errors.adults)} max-w-[140px]`}
              />
              <AnimatePresence>
                {errors.adults && (
                  <motion.p
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    id="rsvp-adults-error"
                    className="mt-1.5 text-xs text-[#8b1a1a] font-body"
                  >
                    {errors.adults}
                  </motion.p>
                )}
              </AnimatePresence>
            </div>

            {/* Children */}
            <fieldset>
              <legend className="block font-cinzel text-xs uppercase tracking-widest mb-2 text-[#1a4a2e]/70">
                Porterete dei bambini? <span aria-label="obbligatorio">*</span>
              </legend>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer group">
                  <input
                    type="radio"
                    name="rsvp-children"
                    checked={bringingChildren}
                    onChange={() => {
                      setBringingChildren(true);
                      if (childrenCount === 0) setChildrenCount(1);
                    }}
                    className="sr-only"
                  />
                  <span
                    className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                      bringingChildren
                        ? 'border-[#1a4a2e]'
                        : 'border-[#1a4a2e]/40 group-hover:border-[#1a4a2e]/70'
                    }`}
                  >
                    {bringingChildren && (
                      <span className="w-2 h-2 rounded-full bg-[#1a4a2e]" />
                    )}
                  </span>
                  <span className="font-body text-sm text-[#1a4a2e]/80">Sì</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer group">
                  <input
                    type="radio"
                    name="rsvp-children"
                    checked={!bringingChildren}
                    onChange={() => {
                      setBringingChildren(false);
                      setChildrenCount(0);
                    }}
                    className="sr-only"
                  />
                  <span
                    className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                      !bringingChildren
                        ? 'border-[#1a4a2e]'
                        : 'border-[#1a4a2e]/40 group-hover:border-[#1a4a2e]/70'
                    }`}
                  >
                    {!bringingChildren && (
                      <span className="w-2 h-2 rounded-full bg-[#1a4a2e]" />
                    )}
                  </span>
                  <span className="font-body text-sm text-[#1a4a2e]/80">No</span>
                </label>
              </div>
              <AnimatePresence>
                {bringingChildren && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="mt-3">
                      <label
                        htmlFor="rsvp-children-count"
                        className="block font-cinzel text-xs uppercase tracking-widest mb-2 text-[#1a4a2e]/70"
                      >
                        Quanti bambini? <span aria-label="obbligatorio">*</span>
                      </label>
                      <input
                        id="rsvp-children-count"
                        type="number"
                        min={1}
                        max={20}
                        value={childrenCount}
                        onChange={(e: ChangeEvent<HTMLInputElement>) =>
                          setChildrenCount(Number(e.target.value))
                        }
                        aria-invalid={!!errors.childrenCount}
                        aria-describedby={
                          errors.childrenCount ? 'rsvp-children-count-error' : undefined
                        }
                        className={`${inputClass(!!errors.childrenCount)} max-w-[140px]`}
                      />
                      <AnimatePresence>
                        {errors.childrenCount && (
                          <motion.p
                            initial={{ opacity: 0, y: -4 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -4 }}
                            id="rsvp-children-count-error"
                            className="mt-1.5 text-xs text-[#8b1a1a] font-body"
                          >
                            {errors.childrenCount}
                          </motion.p>
                        )}
                      </AnimatePresence>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </fieldset>

            {/* Intolerances */}
            <fieldset>
              <legend className="block font-cinzel text-xs uppercase tracking-widest mb-2 text-[#1a4a2e]/70">
                Intolleranze o preferenze alimentari
              </legend>
              <div className="space-y-2">
                {INTOLERANCE_OPTIONS.map(({ value, label }) => (
                  <label key={value} className="flex items-start gap-3 cursor-pointer group">
                    <div className="relative mt-0.5 shrink-0">
                      <input
                        type="checkbox"
                        checked={intolerances.includes(value)}
                        onChange={() => toggleIntolerance(value)}
                        className="sr-only"
                      />
                      <div
                        className={`w-5 h-5 border-2 rounded-sm transition-colors flex items-center justify-center ${
                          intolerances.includes(value)
                            ? 'bg-[#1a4a2e] border-[#1a4a2e]'
                            : 'border-[#1a4a2e]/40 group-hover:border-[#1a4a2e]/70'
                        }`}
                      >
                        <AnimatePresence>
                          {intolerances.includes(value) && (
                            <motion.svg
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              exit={{ scale: 0 }}
                              viewBox="0 0 12 10"
                              className="w-3 h-3 text-[#d4af37]"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth={2}
                            >
                              <polyline points="1,5 4,8 11,1" />
                            </motion.svg>
                          )}
                        </AnimatePresence>
                      </div>
                    </div>
                    <span className="font-body text-sm text-[#1a4a2e]/80 leading-snug">
                      {label}
                    </span>
                  </label>
                ))}
              </div>
              <AnimatePresence>
                {intolerances.includes('other') && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="mt-3">
                      <label
                        htmlFor="rsvp-intolerances-other"
                        className="block font-cinzel text-xs uppercase tracking-widest mb-2 text-[#1a4a2e]/70"
                      >
                        Specifica <span aria-label="obbligatorio">*</span>
                      </label>
                      <textarea
                        id="rsvp-intolerances-other"
                        value={intolerancesOther}
                        onChange={(e: ChangeEvent<HTMLTextAreaElement>) =>
                          setIntolerancesOther(e.target.value)
                        }
                        maxLength={120}
                        rows={2}
                        aria-invalid={!!errors.intolerancesOther}
                        aria-describedby={
                          errors.intolerancesOther ? 'rsvp-intolerances-other-error' : undefined
                        }
                        className={inputClass(!!errors.intolerancesOther)}
                      />
                      <AnimatePresence>
                        {errors.intolerancesOther && (
                          <motion.p
                            initial={{ opacity: 0, y: -4 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -4 }}
                            id="rsvp-intolerances-other-error"
                            className="mt-1.5 text-xs text-[#8b1a1a] font-body"
                          >
                            {errors.intolerancesOther}
                          </motion.p>
                        )}
                      </AnimatePresence>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </fieldset>

            {status === 'error' && (
              <div className="flex items-start gap-2 text-[#8b1a1a] font-body text-sm bg-[#8b1a1a]/10 border border-[#8b1a1a]/20 rounded-sm px-4 py-3">
                <AlertCircle size={16} className="shrink-0 mt-0.5" />
                <span>
                  Non siamo riusciti a salvare il tuo RSVP. Controlla la connessione e riprova.
                </span>
              </div>
            )}

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button
                type="submit"
                disabled={status === 'saving'}
                className="flex-1 flex items-center justify-center gap-3 px-6 py-4 bg-[#1a4a2e] border-[3px] border-double border-[#d4af37] text-[#fdfaf1] font-cinzel tracking-[0.15em] uppercase text-sm hover:bg-[#133823] transition-all duration-300 rounded-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {status === 'saving' ? (
                  <>
                    <Loader2 size={16} className="text-[#d4af37] animate-spin" />
                    Invio in corso…
                  </>
                ) : (
                  <>
                    <Send size={16} className="text-[#d4af37]" />
                    Invia il gufo
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={onClose}
                disabled={status === 'saving'}
                className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-4 border border-[#1a4a2e]/30 text-[#1a4a2e] font-cinzel tracking-[0.12em] uppercase text-sm hover:bg-[#1a4a2e]/5 transition-all rounded-sm disabled:opacity-50"
              >
                Annulla
              </button>
            </div>

            <p className="text-xs text-[#1a4a2e]/50 font-body text-center">
              I dati servono solo a Nicolas e Giulia per organizzare il ricevimento.
            </p>
          </form>
        )}
      </motion.div>
    </motion.div>
  );
}
