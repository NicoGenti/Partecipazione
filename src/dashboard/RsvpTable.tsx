import { useState, useMemo, Fragment } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronUp, ChevronDown, ChevronRight, Search } from 'lucide-react';
import type { RsvpRecord } from './types';
import {
  INTOLERANCE_LABELS,
  RECIPIENT_LABELS,
} from './types';

type SortKey = 'fullName' | 'adults' | 'childrenCount' | 'guestsTotal' | 'submittedAt' | 'recipient';
type SortDir = 'asc' | 'desc';

interface Props {
  rows: RsvpRecord[];
}

function guestsTotal(r: RsvpRecord): number {
  return (r.adults ?? 0) + (r.bringingChildren ? r.childrenCount ?? 0 : 0);
}

function formatDate(iso: string): { date: string; time: string } {
  if (!iso) return { date: '—', time: '' };
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return { date: iso, time: '' };
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    return {
      date: `${dd}/${mm}/${yyyy}`,
      time: `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`,
    };
  } catch {
    return { date: iso, time: '' };
  }
}

function compareRows(a: RsvpRecord, b: RsvpRecord, key: SortKey, dir: SortDir): number {
  const mult = dir === 'asc' ? 1 : -1;
  switch (key) {
    case 'fullName':
      return a.fullName.localeCompare(b.fullName, 'it') * mult;
    case 'adults':
      return (a.adults - b.adults) * mult;
    case 'childrenCount':
      return ((a.bringingChildren ? a.childrenCount : 0) - (b.bringingChildren ? b.childrenCount : 0)) * mult;
    case 'guestsTotal':
      return (guestsTotal(a) - guestsTotal(b)) * mult;
    case 'submittedAt':
      return (a.submittedAt.localeCompare(b.submittedAt)) * mult;
    case 'recipient':
      return a.recipient.localeCompare(b.recipient) * mult;
    default:
      return 0;
  }
}

export default function RsvpTable({ rows }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>('submittedAt');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);

  const sorted = useMemo(() => {
    const filtered = rows.filter((r) => {
      const q = query.trim().toLowerCase();
      if (q.length === 0) return true;
      return (
        r.fullName.toLowerCase().includes(q) ||
        (r.guestNames ?? []).some((n) => n.toLowerCase().includes(q)) ||
        (r.intolerancesOther ?? '').toLowerCase().includes(q) ||
        RECIPIENT_LABELS[r.recipient].toLowerCase().includes(q)
      );
    });
    return [...filtered].sort((a, b) => compareRows(a, b, sortKey, sortDir));
  }, [rows, sortKey, sortDir, query]);

  const toggleSort = (key: SortKey): void => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const SortHeader = ({ k, label, align = 'left' }: { k: SortKey; label: string; align?: 'left' | 'right' | 'center' }) => (
    <th className={`p-2 font-cinzel text-[0.66rem] uppercase tracking-widest text-[#1a4a2e]/70 cursor-pointer select-none ${align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left'}`}
      onClick={() => toggleSort(k)}
      aria-sort={sortKey === k ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {sortKey === k && (
          sortDir === 'asc' ? <ChevronUp size={11} className="text-[#d4af37]" /> : <ChevronDown size={11} className="text-[#d4af37]" />
        )}
      </span>
    </th>
  );

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#1a4a2e]/40" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Cerca per nome, intolleranze o referente…"
          aria-label="Cerca tra gli RSVP"
          className="w-full pl-9 pr-4 py-2 border border-[#1a4a2e]/30 bg-white/60 rounded-sm font-body text-sm text-[#1a4a2e] focus:outline-none focus:border-[#1a4a2e]/60 focus:bg-white/80 transition-colors"
        />
      </div>

      <p className="font-body text-xs text-[#1a4a2e]/60" aria-live="polite">
        {sorted.length} {sorted.length === 1 ? 'RSVP' : 'RSVP trovati'}
        {sorted.length !== rows.length ? ` (di ${rows.length} totali)` : null}
      </p>

      {sorted.length === 0 ? (
        <p className="font-body text-sm text-[#1a4a2e]/50 italic py-8 text-center">
          Nessun RSVP corrisponde alla ricerca.
        </p>
      ) : (
        <div className="overflow-x-auto paper-surface rounded-sm">
          <table className="w-full border-collapse">
            <thead className="border-b border-[#d4af37]/40">
              <tr>
                <th className="w-8 p-2" aria-label="Espandi" />
                <SortHeader k="fullName" label="Nome e cognome" />
                <SortHeader k="recipient" label="Ref" />
                <SortHeader k="adults" label="Adulti" align="right" />
                <SortHeader k="childrenCount" label="Bambini" align="right" />
                <SortHeader k="guestsTotal" label="Tot" align="right" />
                <SortHeader k="submittedAt" label="Inviato il" />
              </tr>
            </thead>
            <tbody>
              {sorted.map((r) => {
                const rowKey = r.deviceId + r.submittedAt;
                const isOpen = expanded === rowKey;
                const submitted = formatDate(r.submittedAt);
                const gt = guestsTotal(r);

                return (
                  <Fragment key={rowKey}>
                    <tr
                      onClick={() => setExpanded(isOpen ? null : rowKey)}
                      className="border-b border-[#d4af37]/20 last:border-0 hover:bg-[#d4af37]/5 cursor-pointer transition-colors"
                      aria-expanded={isOpen}
                    >
                      <td className="p-2 text-[#1a4a2e]/40">
                        {isOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                      </td>
                      <td className="p-2 font-body text-sm text-[#1a4a2e] font-medium">{r.fullName}</td>
                      <td className="p-2 text-center">
                        <span className="inline-flex px-2 py-0.5 rounded-full text-[0.6rem] font-cinzel uppercase tracking-wider border"
                          style={{
                            borderColor: r.recipient === 'nicolas' ? '#1a4a2e' : '#8b1a1a',
                            color: r.recipient === 'nicolas' ? '#1a4a2e' : '#8b1a1a',
                          }}
                        >
                          {RECIPIENT_LABELS[r.recipient]}
                        </span>
                      </td>
                      <td className="p-2 text-right font-body text-sm text-[#1a4a2e] tabular-nums">{r.adults}</td>
                      <td className="p-2 text-right font-body text-sm text-[#1a4a2e] tabular-nums">
                        {r.bringingChildren ? r.childrenCount : '—'}
                      </td>
                      <td className="p-2 text-right font-cinzel text-sm text-[#1a4a2e] font-semibold tabular-nums">{gt}</td>
                      <td className="p-2 font-body text-xs text-[#1a4a2e]/70 whitespace-nowrap">
                        {submitted.date}
                        {submitted.time && <span className="text-[#1a4a2e]/40 ml-1">{submitted.time}</span>}
                      </td>
                    </tr>
                    <AnimatePresence>
                      {isOpen && (
                        <tr key={rowKey + '-detail'}>
                          <td colSpan={7} className="p-0">
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.2 }}
                              className="overflow-hidden"
                            >
                              <div className="p-4 bg-[#fdfaf1]/60 border-t border-[#d4af37]/20 space-y-2 text-sm font-body text-[#1a4a2e]">
                                {r.guestNames && r.guestNames.length > 0 && (
                                  <p><strong className="font-cinzel text-[0.66rem] uppercase tracking-widest text-[#1a4a2e]/60">Accompagnatori:</strong> {r.guestNames.filter(Boolean).join(', ')}</p>
                                )}
                                <p><strong className="font-cinzel text-[0.66rem] uppercase tracking-widest text-[#1a4a2e]/60">Intolleranze:</strong> {r.intolerances.length > 0 ? r.intolerances.map((it) => INTOLERANCE_LABELS[it]).join(', ') : 'nessuna'}</p>
                                {r.intolerancesOther && (
                                  <p><strong className="font-cinzel text-[0.66rem] uppercase tracking-widest text-[#1a4a2e]/60">Dettaglio:</strong> {r.intolerancesOther}</p>
                                )}
                                <p className="text-xs text-[#1a4a2e]/40 font-mono break-all">deviceId: {r.deviceId}</p>
                              </div>
                            </motion.div>
                          </td>
                        </tr>
                      )}
                    </AnimatePresence>
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}