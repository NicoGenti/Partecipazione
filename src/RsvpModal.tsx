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
  validateRsvp,
  type GuestIntolerances,
  type Intolerance,
  type RsvpRecord,
} from './rsvp';

interface Props {
  onClose: () => void;
}

function IntoleranceCheckboxes({
  label,
  values,
  onToggle,
  otherValue,
  onOtherChange,
  otherError,
}: {
  label: string;
  values: Intolerance[];
  onToggle: (v: Intolerance) => void;
  otherValue?: string;
  onOtherChange?: (v: string) => void;
  otherError?: string;
}) {
  return (
    <div className="mt-2 pl-1 border-l-2 border-[#d4af37]/30">
      <p className="font-cinzel text-[0.6rem] uppercase tracking-widest mb-2 text-[#1a4a2e]/60">
        {label}
      </p>
      <div className="space-y-1.5">
        {INTOLERANCE_OPTIONS.map(({ value, label: optLabel }) => (
          <label key={value} className="flex items-start gap-3 cursor-pointer group">
            <div className="relative mt-0.5 shrink-0">
              <input
                type="checkbox"
                checked={values.includes(value)}
                onChange={() => onToggle(value)}
                className="sr-only"
              />
              <div
                className={`w-4 h-4 border-2 rounded-sm transition-colors flex items-center justify-center ${
                  values.includes(value)
                    ? 'bg-[#1a4a2e] border-[#1a4a2e]'
                    : 'border-[#1a4a2e]/40 group-hover:border-[#1a4a2e]/70'
                }`}
              >
                <AnimatePresence>
                  {values.includes(value) && (
                    <motion.svg
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      exit={{ scale: 0 }}
                      viewBox="0 0 12 10"
                      className="w-2.5 h-2.5 text-[#d4af37]"
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
            <span className="font-body text-xs text-[#1a4a2e]/70 leading-snug">
              {optLabel}
            </span>
          </label>
        ))}
      </div>
      <AnimatePresence>
        {values.includes('other') && onOtherChange && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="mt-2">
              <textarea
                value={otherValue ?? ''}
                onChange={(e) => onOtherChange(e.target.value)}
                maxLength={120}
                rows={1}
                placeholder="Specifica…"
                aria-invalid={!!otherError}
                className={`w-full border rounded-sm px-3 py-1.5 font-body text-xs text-[#1a4a2e] placeholder:text-[#1a4a2e]/30 focus:outline-none transition-colors ${
                  otherError
                    ? 'border-[#8b1a1a] bg-[#8b1a1a]/5'
                    : 'border-[#1a4a2e]/30 bg-white/60 focus:border-[#1a4a2e]/60'
                }`}
              />
              {otherError && (
                <p className="mt-0.5 text-[0.6rem] text-[#8b1a1a] font-body">{otherError}</p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function RsvpModal({ onClose }: Props) {
  const reduced = useReducedMotion();
  const cardRef = useRef<HTMLDivElement>(null);
  const firstFieldRef = useRef<HTMLInputElement>(null);

  const [fullName, setFullName] = useState('');
  const [adults, setAdults] = useState<number>(1);
  const [guestNames, setGuestNames] = useState<string[]>([]);
  const [bringingChildren, setBringingChildren] = useState(false);
  const [childrenCount, setChildrenCount] = useState<number>(0);

  // Per-person intolerances
  const [respondentIntolerances, setRespondentIntolerances] = useState<Intolerance[]>([]);
  const [respondentIntolerancesOther, setRespondentIntolerancesOther] = useState('');
  const [guestIntoleranceList, setGuestIntoleranceList] = useState<
    { intolerances: Intolerance[]; intolerancesOther: string }[]
  >([]);
  const [childrenIntolerances, setChildrenIntolerances] = useState<Intolerance[]>([]);
  const [childrenIntolerancesOther, setChildrenIntolerancesOther] = useState('');
  const [guestOtherErrors, setGuestOtherErrors] = useState<Record<number, string>>({});

  const [status, setStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
  const [errors, setErrors] = useState<Partial<Record<keyof RsvpRecord, string>>>({});

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

  useEffect(() => {
    const targetLen = Math.max(0, adults - 1);
    setGuestNames((prev) => {
      if (prev.length === targetLen) return prev;
      const next = prev.slice(0, targetLen);
      while (next.length < targetLen) next.push('');
      return next;
    });
    setGuestIntoleranceList((prev) => {
      if (prev.length === targetLen) return prev;
      const next = prev.slice(0, targetLen);
      while (next.length < targetLen)
        next.push({ intolerances: [], intolerancesOther: '' });
      return next;
    });
  }, [adults]);

  const toggleRespondentIntolerance = useCallback((value: Intolerance) => {
    setRespondentIntolerances((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value],
    );
  }, []);

  const toggleGuestIntolerance = useCallback(
    (index: number, value: Intolerance) => {
      setGuestIntoleranceList((prev) => {
        const next = [...prev];
        const person = { ...next[index] };
        person.intolerances = person.intolerances.includes(value)
          ? person.intolerances.filter((v) => v !== value)
          : [...person.intolerances, value];
        next[index] = person;
        return next;
      });
    },
    [],
  );

  const setGuestOther = useCallback((index: number, value: string) => {
    setGuestIntoleranceList((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], intolerancesOther: value };
      return next;
    });
  }, []);

  const toggleChildrenIntolerance = useCallback((value: Intolerance) => {
    setChildrenIntolerances((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value],
    );
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (status === 'saving') return;

    // Build per-guest intolerances array
    const guests: GuestIntolerances[] = [
      {
        name: fullName.trim(),
        intolerances: respondentIntolerances,
        intolerancesOther: respondentIntolerances.includes('other')
          ? respondentIntolerancesOther
          : '',
      },
      ...guestIntoleranceList.map((g, i) => ({
        name: guestNames[i]?.trim() || '',
        intolerances: g.intolerances,
        intolerancesOther: g.intolerances.includes('other') ? g.intolerancesOther : '',
      })),
    ];
    if (bringingChildren && childrenCount > 0) {
      const childLabel = childrenCount === 1 ? 'Bambino' : 'Bambini';
      guests.push({
        name: childLabel,
        intolerances: childrenIntolerances,
        intolerancesOther: childrenIntolerances.includes('other')
          ? childrenIntolerancesOther
          : '',
      });
    }

    // Validate per-guest "other" fields
    const newGuestErrors: Record<number, string> = {};
    for (let i = 1; i < guests.length; i++) {
      const g = guests[i];
      if (g.intolerances.includes('other') && !g.intolerancesOther.trim()) {
        newGuestErrors[i] = 'Specifica l\'intolleranza o la preferenza';
      }
    }
    setGuestOtherErrors(newGuestErrors);
    if (Object.keys(newGuestErrors).length > 0) {
      setStatus('idle');
      return;
    }

    const draft = {
      fullName,
      adults,
      guestNames,
      bringingChildren,
      childrenCount: bringingChildren ? childrenCount : 0,
      intolerances: respondentIntolerances,
      intolerancesOther: respondentIntolerances.includes('other') ? respondentIntolerancesOther : '',
      guestIntolerances: guests,
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
              Grazie per aver confermato! Se vuoi, puoi inviare un messaggio diretto su WhatsApp.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <a
                href={buildWhatsAppUrl('nicolas')}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-[#1a4a2e] border-[3px] border-double border-[#d4af37] text-[#fdfaf1] font-cinzel tracking-[0.15em] uppercase text-sm hover:bg-[#133823] transition-all duration-300 rounded-sm"
              >
                <Send size={14} className="text-[#d4af37]" />
                Scrivi a Nicolas
              </a>
              <a
                href={buildWhatsAppUrl('giulia')}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-[#8b1a1a] border-[3px] border-double border-[#d4af37] text-[#fdfaf1] font-cinzel tracking-[0.15em] uppercase text-sm hover:bg-[#6e1414] transition-all duration-300 rounded-sm"
              >
                <Send size={14} className="text-[#d4af37]" />
                Scrivi a Giulia
              </a>
            </div>
            <div className="mt-4">
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
            {/* Name + respondent intolerances */}
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
              <IntoleranceCheckboxes
                label="Le tue intolleranze o preferenze alimentari"
                values={respondentIntolerances}
                onToggle={toggleRespondentIntolerance}
                otherValue={respondentIntolerancesOther}
                onOtherChange={setRespondentIntolerancesOther}
                otherError={errors.intolerancesOther}
              />
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

            {/* Guest names — shown when adults > 1 */}
            {adults > 1 && (
              <div>
                <p className="font-cinzel text-xs uppercase tracking-widest mb-3 text-[#1a4a2e]/70">
                  Nome e cognome degli accompagnatori <span aria-label="obbligatorio">*</span>
                </p>
                <div className="space-y-3">
                  {guestNames.map((name, i) => (
                    <div key={i}>
                      <label
                        htmlFor={`rsvp-guest-${i}`}
                        className="block font-cinzel text-[0.65rem] uppercase tracking-widest mb-1.5 text-[#1a4a2e]/50"
                      >
                        Accompagnatore {i + 1}
                      </label>
                      <input
                        id={`rsvp-guest-${i}`}
                        type="text"
                        value={name}
                        onChange={(e: ChangeEvent<HTMLInputElement>) => {
                          setGuestNames((prev) => {
                            const next = [...prev];
                            next[i] = e.target.value;
                            return next;
                          });
                        }}
                        placeholder="Es. Maria Rossi"
                        maxLength={80}
                        aria-invalid={!!errors.guestNames}
                        className={inputClass(!!errors.guestNames)}
                      />
                      <IntoleranceCheckboxes
                        label="Intolleranze o preferenze"
                        values={guestIntoleranceList[i]?.intolerances ?? []}
                        onToggle={(v) => toggleGuestIntolerance(i, v)}
                        otherValue={guestIntoleranceList[i]?.intolerancesOther ?? ''}
                        onOtherChange={(v) => setGuestOther(i, v)}
                        otherError={guestOtherErrors[i]}
                      />
                    </div>
                  ))}
                </div>
                <AnimatePresence>
                  {errors.guestNames && (
                    <motion.p
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      className="mt-1.5 text-xs text-[#8b1a1a] font-body"
                    >
                      {errors.guestNames}
                    </motion.p>
                  )}
                </AnimatePresence>
              </div>
            )}

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
                      <IntoleranceCheckboxes
                        label="Intolleranze o preferenze dei bambini"
                        values={childrenIntolerances}
                        onToggle={toggleChildrenIntolerance}
                        otherValue={childrenIntolerancesOther}
                        onOtherChange={setChildrenIntolerancesOther}
                      />
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
