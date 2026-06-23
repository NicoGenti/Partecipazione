import { useState, useEffect, useRef, type FormEvent } from 'react';
import { motion } from 'motion/react';
import { Feather, ArrowLeft, Loader2, AlertCircle } from 'lucide-react';

interface Props {
  onSubmit: (key: string) => Promise<void> | void;
  onBack: () => void;
  initialError?: string | null;
  isLoading?: boolean;
}

export default function DashboardLogin({
  onSubmit,
  onBack,
  initialError,
  isLoading,
}: Props) {
  const [key, setKey] = useState('');
  const [error, setError] = useState<string | null>(initialError ?? null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 50);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (initialError) setError(initialError);
  }, [initialError]);

  useEffect(() => {
    const handler = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') onBack();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onBack]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (isLoading || key.trim().length === 0) return;
    setError(null);
    void onSubmit(key.trim());
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{
        background:
          'radial-gradient(ellipse at center, #0c0d12 0%, #060608 100%)',
      }}
    >
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="relative w-full max-w-md paper-surface rounded-sm p-8 text-[#1a4a2e]"
      >
        <button
          type="button"
          onClick={onBack}
          className="absolute top-4 left-4 text-[#1a4a2e]/50 hover:text-[#1a4a2e] transition-colors flex items-center gap-1 text-xs font-cinzel uppercase tracking-widest"
          aria-label="Torna all'invito"
        >
          <ArrowLeft size={14} />
          Invito
        </button>

        <div className="flex flex-col items-center mb-6 mt-4">
          <div className="w-14 h-14 rounded-full bg-[#1a4a2e] flex items-center justify-center mb-4">
            <Feather size={28} className="text-[#d4af37]" />
          </div>
          <h1 className="font-cinzel text-xl sm:text-2xl uppercase tracking-widest text-center font-bold">
            Camera dei Segreti
          </h1>
          <p className="font-body text-sm text-[#1a4a2e]/70 mt-2 text-center">
            Inserisci la passphrase per consultare gli RSVP
          </p>
          <div className="w-24 h-px bg-[#d4af37] mt-3" />
        </div>

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <label
            htmlFor="admin-key"
            className="block font-cinzel text-xs uppercase tracking-widest mb-2 text-[#1a4a2e]/70"
          >
            Passphrase <span aria-label="obbligatorio">*</span>
          </label>
          <input
            ref={inputRef}
            id="admin-key"
            type="password"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder="••••••••••••••••"
            autoComplete="off"
            spellCheck={false}
            aria-invalid={!!error}
            aria-describedby={error ? 'admin-key-error' : undefined}
            className="w-full border rounded-sm px-4 py-3 font-mono text-sm bg-white/60 focus:bg-white/90 transition-colors focus:outline-none border-[#1a4a2e]/40 focus:border-[#1a4a2e]"
          />

          {error && (
            <div
              id="admin-key-error"
              role="alert"
              className="flex items-start gap-2 text-[#8b1a1a] font-body text-sm bg-[#8b1a1a]/10 border border-[#8b1a1a]/20 rounded-sm px-3 py-2"
            >
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading || key.trim().length === 0}
            className="w-full flex items-center justify-center gap-3 px-6 py-3.5 bg-[#1a4a2e] border-[3px] border-double border-[#d4af37] text-[#fdfaf1] font-cinzel tracking-[0.15em] uppercase text-sm hover:bg-[#133823] transition-all duration-300 rounded-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <>
                <Loader2 size={16} className="text-[#d4af37] animate-spin" />
                Sto verificando…
              </>
            ) : (
              <>
                <Feather size={16} className="text-[#d4af37]" />
                Entra
              </>
            )}
          </button>
        </form>

        <p className="text-xs text-[#1a4a2e]/50 font-body text-center mt-6">
          Riservato a Nicolas e Giulia. La passphrase non viene mai salvata nel sito.
        </p>
      </motion.div>
    </div>
  );
}