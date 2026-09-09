import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Images, Trash2, Loader2, AlertCircle, RefreshCw } from 'lucide-react';
import { listPhotos, buildBlobUrl } from '../azure';
import { deletePhotos, getStoredAdminKey } from './apiClient';

/** Dimensione massima di un blocco di eliminazione (limite lato server). */
const CHUNK_SIZE = 100;

type ListPhase = 'loading' | 'ready' | 'error';

/**
 * Sezione di gestione foto dell'admin: griglia di miniature con selezione,
 * eliminazione in batch con conferma a due click e stato inline in italiano.
 */
export default function PhotoManager() {
  const [phase, setPhase] = useState<ListPhase>('loading');
  const [paths, setPaths] = useState<string[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadList = () => {
    setPhase('loading');
    setError(null);
    listPhotos()
      .then((names) => {
        setPaths(names);
        setPhase('ready');
      })
      .catch(() => {
        setPhase('error');
        setError('Impossibile caricare le foto. Riprova più tardi.');
      });
  };

  useEffect(() => {
    loadList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggle = (path: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  const handleDelete = async () => {
    if (busy || selected.size === 0) return;

    if (!confirming) {
      setConfirming(true);
      setTimeout(() => setConfirming(false), 2500);
      return;
    }

    const adminKey = getStoredAdminKey();
    if (!adminKey) {
      setError(
        'Sessione scaduta: Admin-Key non più disponibile. Premi "Esci" e accedi di nuovo.',
      );
      setConfirming(false);
      return;
    }

    setBusy(true);
    setConfirming(false);
    setError(null);
    setStatus(null);

    let deletedCount = 0;
    let missingCount = 0;
    let failedCount = 0;

    const all = [...selected];
    try {
      for (let i = 0; i < all.length; i += CHUNK_SIZE) {
        const chunk = all.slice(i, i + CHUNK_SIZE);
        const reply = await deletePhotos(adminKey, chunk);

        deletedCount += reply.deleted.length;
        missingCount += reply.missing.length;
        failedCount += reply.failed.length;

        const removed = new Set([...reply.deleted, ...reply.missing]);
        setPaths((prev) => prev.filter((p) => !removed.has(p)));
        setSelected((prev) => {
          const next = new Set(prev);
          for (const name of removed) next.delete(name);
          return next;
        });
      }

      const parts: string[] = [];
      if (deletedCount > 0 || (deletedCount === 0 && missingCount === 0 && failedCount === 0)) {
        parts.push(`Eliminate ${deletedCount}`);
      }
      if (missingCount > 0) parts.push(`già rimosse ${missingCount}`);
      if (failedCount > 0) parts.push(`fallite ${failedCount}`);
      setStatus(parts.join(' · '));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Impossibile eliminare le foto. Riprova più tardi.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.2 }}
      className="paper-surface rounded-sm p-6 sm:p-8"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div className="flex items-center gap-2">
          <Images size={16} className="text-[#d4af37]" />
          <h2 className="font-cinzel text-sm uppercase tracking-widest text-[#1a4a2e]">
            Gestione foto
          </h2>
        </div>
        <button
          type="button"
          onClick={handleDelete}
          disabled={selected.size === 0 || busy}
          className="inline-flex items-center gap-2 px-4 py-2 bg-[#8b1a1a] border-[3px] border-double border-[#d4af37] text-[#fdfaf1] font-cinzel tracking-widest text-xs uppercase rounded-sm hover:bg-[#6d1414] transition-colors disabled:opacity-50"
        >
          {busy ? (
            <Loader2 size={12} className="text-[#d4af37] animate-spin" />
          ) : (
            <Trash2 size={12} className="text-[#d4af37]" />
          )}
          {busy ? 'Eliminazione…' : confirming ? 'Confermi?' : `Elimina selezionate (${selected.size})`}
        </button>
      </div>

      {phase === 'loading' && (
        <div className="flex items-center justify-center gap-3 py-12 text-[#1a4a2e]/50 font-body text-sm">
          <Loader2 size={20} className="animate-spin text-[#d4af37]" />
          <span>Caricamento delle foto…</span>
        </div>
      )}

      {phase === 'error' && (
        <div className="flex flex-col items-center justify-center gap-3 py-10">
          <div className="flex items-center gap-2 text-[#8b1a1a]/80 font-body text-sm">
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={loadList}
            className="inline-flex items-center gap-2 px-4 py-2 border border-[#d4af37]/40 text-[#1a4a2e] font-cinzel tracking-widest text-xs uppercase rounded-sm hover:bg-[#d4af37]/10 transition-colors"
          >
            <RefreshCw size={12} />
            Riprova
          </button>
        </div>
      )}

      {phase === 'ready' && paths.length === 0 && (
        <p className="font-body text-sm text-[#1a4a2e]/60 py-8 text-center">
          Nessuna foto presente nell'album.
        </p>
      )}

      {phase === 'ready' && paths.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {paths.map((path) => (
            <button
              key={path}
              type="button"
              onClick={() => toggle(path)}
              aria-pressed={selected.has(path)}
              aria-label={selected.has(path) ? 'Deseleziona foto' : 'Seleziona foto'}
              className={`relative aspect-square bg-[#1a4a2e]/5 rounded-sm overflow-hidden border transition-colors ${
                selected.has(path)
                  ? 'border-[#d4af37] ring-2 ring-[#d4af37]/60'
                  : 'border-[#d4af37]/30 hover:border-[#d4af37]'
              }`}
            >
              <img
                loading="lazy"
                src={buildBlobUrl(path)}
                alt=""
                className="w-full h-full object-cover"
                draggable={false}
              />
              <span
                className={`absolute top-2 right-2 w-5 h-5 rounded-sm grid place-items-center border transition-colors ${
                  selected.has(path)
                    ? 'bg-[#d4af37] border-[#d4af37]'
                    : 'bg-[#fdfaf1]/80 border-[#d4af37]/50'
                }`}
              >
                {selected.has(path) && (
                  <svg viewBox="0 0 12 12" className="w-3 h-3" aria-hidden="true">
                    <path
                      d="M2 6.5L4.5 9L10 3"
                      fill="none"
                      stroke="#1a4a2e"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                )}
              </span>
            </button>
          ))}
        </div>
      )}

      {status && (
        <p className="font-body text-xs text-[#1a4a2e] mt-4" role="status">
          {status}
        </p>
      )}
      {error && phase !== 'error' && (
        <p className="font-body text-xs text-[#8b1a1a] mt-4" role="alert">
          {error}
        </p>
      )}
    </motion.section>
  );
}