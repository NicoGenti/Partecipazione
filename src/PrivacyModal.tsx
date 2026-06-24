import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Shield } from 'lucide-react';
import { saveConsent, genUUID } from './azure';

const CONSENT_VERSION = 'v1';
const STORAGE_KEY     = 'partecipazione_consent';

export interface ConsentData {
  deviceId: string;
  accepted: boolean;
  nickname: string;
}

export function getStoredConsent(): ConsentData | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as ConsentData) : null;
  } catch {
    return null;
  }
}

function getOrCreateDeviceId(): string {
  const stored = getStoredConsent();
  if (stored?.deviceId) return stored.deviceId;
  return genUUID();
}

interface Props {
  onAccepted: (data: ConsentData) => void;
  onClose: () => void;
}

export default function PrivacyModal({ onAccepted, onClose }: Props) {
  const [nickname, setNickname]   = useState('');
  const [checked, setChecked]     = useState(false);
  const [saving, setSaving]       = useState(false);
  const [error, setError]         = useState<string | null>(null);

  const handleAccept = async () => {
    if (!checked) return;
    setSaving(true);
    setError(null);

    const deviceId = getOrCreateDeviceId();
    const record = {
      deviceId,
      nickname: nickname.trim(),
      consent: true,
      consentTextVersion: CONSENT_VERSION,
      timestamp: new Date().toISOString(),
      device: {
        userAgent:        navigator.userAgent,
        platform:         navigator.platform,
        language:         navigator.language,
        languages:        Array.from(navigator.languages),
        screen:           `${screen.width}x${screen.height}`,
        devicePixelRatio: window.devicePixelRatio,
        timezone:         Intl.DateTimeFormat().resolvedOptions().timeZone,
        touch:            navigator.maxTouchPoints > 0,
      },
    };

    await saveConsent(record);

    const consentData: ConsentData = { deviceId, accepted: true, nickname: nickname.trim() };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(consentData));
    setSaving(false);
    onAccepted(consentData);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.92, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.92, y: 20 }}
        transition={{ type: 'spring', damping: 28, stiffness: 280 }}
        className="relative w-full max-w-lg paper-surface rounded-sm p-8 sm:p-10 text-[#1a4a2e] overflow-y-auto max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-[#1a4a2e]/50 hover:text-[#1a4a2e] transition-colors"
          aria-label="Chiudi"
        >
          <X size={20} />
        </button>

        {/* Header */}
        <div className="flex flex-col items-center mb-6">
          <div className="w-12 h-12 rounded-full bg-[#1a4a2e] flex items-center justify-center mb-3">
            <Shield size={24} className="text-[#d4af37]" />
          </div>
          <h2 className="font-cinzel text-lg sm:text-xl uppercase tracking-widest text-center font-bold">
            Patto Magico sulla Privacy
          </h2>
          <div className="w-24 h-px bg-[#d4af37] mt-3" />
        </div>

        {/* Body */}
        <div className="font-body text-sm leading-relaxed space-y-4 text-[#1a4a2e]/90">
          <p>
            Benvenuto nell'<span className="font-semibold">Album della Magia</span> di Nicolas e Giulia.
            Prima di condividere i tuoi ricordi, ti chiediamo di prendere visione del nostro patto.
          </p>
          <ul className="list-disc list-inside space-y-2 text-[#1a4a2e]/80">
            <li>Le foto che carichi saranno <strong>visibili a tutti gli invitati</strong> che accedono a questa pagina.</li>
            <li>Le immagini sono conservate su uno storage privato degli sposi.</li>
            <li>Caricando foto, dichiari di avere il <strong>consenso delle persone ritratte</strong>.</li>
            <li>Per identificare il tuo dispositivo raccogliamo dati tecnici del dispositivo (browser, schermo, fuso orario) insieme a un nickname opzionale da te scelto.</li>
            <li>Nessun dato viene ceduto a terze parti.</li>
          </ul>
          <p className="text-xs text-[#1a4a2e]/60 pt-2">
            Trattamento ai sensi del GDPR (Reg. UE 2016/679). Titolare del trattamento: Nicolas Gentilucci.
          </p>
        </div>

        {/* Nickname */}
        <div className="mt-6">
          <label className="block font-cinzel text-xs uppercase tracking-widest mb-2 text-[#1a4a2e]/70">
            Nickname (opzionale)
          </label>
          <input
            type="text"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            placeholder="Es. Zio Marco, La cugina Fede…"
            maxLength={40}
            className="w-full border border-[#1a4a2e]/30 bg-white/60 rounded-sm px-4 py-2 font-body text-sm text-[#1a4a2e] placeholder:text-[#1a4a2e]/30 focus:outline-none focus:border-[#1a4a2e]/60 focus:bg-white/80 transition-colors"
          />
        </div>

        {/* Checkbox */}
        <label className="flex items-start gap-3 mt-5 cursor-pointer group">
          <div className="relative mt-0.5 shrink-0">
            <input
              type="checkbox"
              checked={checked}
              onChange={(e) => setChecked(e.target.checked)}
              className="sr-only"
            />
            <div className={`w-5 h-5 border-2 rounded-sm transition-colors flex items-center justify-center ${checked ? 'bg-[#1a4a2e] border-[#1a4a2e]' : 'border-[#1a4a2e]/40 group-hover:border-[#1a4a2e]/70'}`}>
              <AnimatePresence>
                {checked && (
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
            Ho letto il patto e <strong>accetto il trattamento dei miei dati</strong> per la condivisione delle foto del matrimonio.
          </span>
        </label>

        {error && (
          <p className="mt-3 text-sm text-[#8b1a1a] font-body">{error}</p>
        )}

        {/* CTA */}
        <button
          onClick={handleAccept}
          disabled={!checked || saving}
          className="mt-6 w-full flex items-center justify-center gap-3 px-8 py-4 bg-[#1a4a2e] border-[3px] border-double border-[#d4af37] text-[#fdfaf1] font-cinzel tracking-[0.15em] uppercase text-sm hover:bg-[#133823] transition-all duration-300 rounded-sm disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {saving ? 'Registrazione in corso…' : 'Accetto e continua'}
        </button>
      </motion.div>
    </motion.div>
  );
}
