import { useState, type ReactNode } from 'react';
import { motion } from 'motion/react';
import {
  ArrowLeft,
  Users,
  Baby,
  Utensils,
  Calendar,
  FileDown,
  LogOut,
  RefreshCw,
} from 'lucide-react';
import type { DashboardReply } from './types';
import { INTOLERANCE_LABELS, RECIPIENT_LABELS } from './types';
import { downloadCsv } from './csvExport';
import RsvpTable from './RsvpTable';

interface Props {
  data: DashboardReply;
  onLogout: () => void;
  onRefresh: () => void;
  isRefreshing?: boolean;
}

const INTOLERANCE_ORDER = [
  'vegetarian',
  'vegan',
  'celiac',
  'lactose-free',
  'nut-allergy',
  'other',
] as const;

export default function DashboardView({
  data,
  onLogout,
  onRefresh,
  isRefreshing,
}: Props) {
  const [confirmingLogout, setConfirmingLogout] = useState(false);
  const { summary, rows } = data;

  const handleLogout = () => {
    if (!confirmingLogout) {
      setConfirmingLogout(true);
      setTimeout(() => setConfirmingLogout(false), 2500);
      return;
    }
    onLogout();
  };

  return (
    <div
      className="min-h-screen"
      style={{
        background:
          'radial-gradient(ellipse at top, #0c0d12 0%, #060608 100%)',
      }}
    >
      {/* Header */}
      <header
        className="sticky top-0 z-40 backdrop-blur-md"
        style={{
          background: 'rgba(12,13,18,0.85)',
          borderBottom: '1px solid rgba(212,175,55,0.2)',
        }}
      >
        <div className="max-w-6xl mx-auto px-4 sm:px-8 h-[3.75rem] flex items-center gap-3">
          <button
            type="button"
            onClick={() => {
              window.location.hash = '';
            }}
            className="text-[#fdfaf1]/70 hover:text-[#d4af37] transition-colors flex items-center gap-1.5 text-xs font-cinzel uppercase tracking-widest"
            aria-label="Torna all'invito"
          >
            <ArrowLeft size={14} />
            Invito
          </button>

          <h1 className="font-cinzel text-base sm:text-lg uppercase tracking-widest text-[#fdfaf1] ml-2 flex items-center gap-2">
            <span style={{ color: '#d4af37' }}>·</span>
            Camera dei Segreti
          </h1>

          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={onRefresh}
              disabled={isRefreshing}
              className="inline-flex items-center gap-2 px-3 py-2 border border-[#d4af37]/40 text-[#fdfaf1]/80 font-cinzel tracking-widest text-xs uppercase rounded-sm hover:bg-[#d4af37]/10 transition-colors disabled:opacity-50"
              aria-label="Aggiorna"
            >
              <RefreshCw size={12} className={isRefreshing ? 'animate-spin' : ''} />
              Aggiorna
            </button>
            <button
              type="button"
              onClick={handleLogout}
              className="inline-flex items-center gap-2 px-3 py-2 border border-[#8b1a1a]/50 text-[#fdfaf1]/80 font-cinzel tracking-widest text-xs uppercase rounded-sm hover:bg-[#8b1a1a]/20 transition-colors"
              aria-label={confirmingLogout ? 'Conferma logout' : 'Esci dalla dashboard'}
            >
              <LogOut size={12} />
              {confirmingLogout ? 'Confermi?' : 'Esci'}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-8 py-8 sm:py-12 space-y-8">
        {/* Hero summary */}
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="paper-surface rounded-sm p-6 sm:p-10"
        >
          <div className="flex flex-col sm:flex-row sm:items-end gap-2 mb-6">
            <div>
              <p className="font-cinzel text-[0.66rem] uppercase tracking-[0.22em] text-[#1a4a2e]/60">
                Totale RSVP
              </p>
              <p
                className="font-cinzel font-light leading-none tabular-nums"
                style={{ fontSize: 'clamp(3rem, 8vw, 5rem)', color: '#1a4a2e' }}
              >
                {summary.total}
              </p>
            </div>
            <div className="sm:ml-auto flex flex-wrap gap-3 text-sm font-body">
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#1a4a2e]/10 text-[#1a4a2e]">
                <span className="w-2 h-2 rounded-full bg-[#1a4a2e]" />
                Nicolas: <strong className="tabular-nums">{summary.byRecipient.nicolas}</strong>
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#8b1a1a]/10 text-[#8b1a1a]">
                <span className="w-2 h-2 rounded-full bg-[#8b1a1a]" />
                Giulia: <strong className="tabular-nums">{summary.byRecipient.giulia}</strong>
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <StatCard
              icon={<Users size={16} className="text-[#d4af37]" />}
              label="Adulti"
              value={summary.adultsTotal}
              color="#1a4a2e"
            />
            <StatCard
              icon={<Baby size={16} className="text-[#d4af37]" />}
              label="Bambini"
              value={summary.childrenTotal}
              color="#1a4a2e"
            />
            <StatCard
              icon={<Users size={16} className="text-[#d4af37]" />}
              label="Ospiti totali"
              value={summary.guestsTotal}
              color="#1a4a2e"
              highlight
            />
          </div>
        </motion.section>

        {/* Last 7 days */}
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.05 }}
          className="paper-surface rounded-sm p-6 sm:p-8"
        >
          <div className="flex items-center gap-2 mb-5">
            <Calendar size={16} className="text-[#d4af37]" />
            <h2 className="font-cinzel text-sm uppercase tracking-widest text-[#1a4a2e]">
              RSVP ultimi 7 giorni
            </h2>
          </div>

          <SevenDaysChart days={summary.lastSevenDays} />

          <p className="font-body text-xs text-[#1a4a2e]/60 mt-4">
            Totale ultimi 7 giorni:{' '}
            <strong className="tabular-nums">
              {summary.lastSevenDays.reduce((acc, d) => acc + d.count, 0)}
            </strong>
          </p>
        </motion.section>

        {/* Intolerances */}
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="paper-surface rounded-sm p-6 sm:p-8"
        >
          <div className="flex items-center gap-2 mb-5">
            <Utensils size={16} className="text-[#d4af37]" />
            <h2 className="font-cinzel text-sm uppercase tracking-widest text-[#1a4a2e]">
              Intolleranze e preferenze
            </h2>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {INTOLERANCE_ORDER.map((key) => (
              <div
                key={key}
                className="flex items-center justify-between px-3 py-2 rounded-sm border border-[#d4af37]/30 bg-[#fdfaf1]"
              >
                <span className="font-body text-xs text-[#1a4a2e]">
                  {INTOLERANCE_LABELS[key]}
                </span>
                <span className="font-cinzel text-sm font-semibold tabular-nums text-[#1a4a2e]">
                  {summary.intolerances[key]}
                </span>
              </div>
            ))}
          </div>

          {summary.intolerancesOther.length > 0 && (
            <div className="mt-4">
              <p className="font-cinzel text-[0.66rem] uppercase tracking-widest text-[#1a4a2e]/60 mb-2">
                Dettaglio “Altro”
              </p>
              <ul className="space-y-1">
                {summary.intolerancesOther.map((text, i) => (
                  <li
                    key={i}
                    className="font-body text-sm text-[#1a4a2e] border-l-2 border-[#d4af37] pl-3"
                  >
                    {text}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </motion.section>

        {/* Detail table */}
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.15 }}
          className="paper-surface rounded-sm p-6 sm:p-8"
        >
          <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
            <h2 className="font-cinzel text-sm uppercase tracking-widest text-[#1a4a2e]">
              Elenco RSVP
            </h2>
            <button
              type="button"
              onClick={() => downloadCsv(rows)}
              disabled={rows.length === 0}
              className="inline-flex items-center gap-2 px-4 py-2 bg-[#1a4a2e] border-[3px] border-double border-[#d4af37] text-[#fdfaf1] font-cinzel tracking-widest text-xs uppercase rounded-sm hover:bg-[#133823] transition-colors disabled:opacity-50"
            >
              <FileDown size={12} className="text-[#d4af37]" />
              Esporta CSV
            </button>
          </div>

          <RsvpTable rows={rows} />
        </motion.section>

        <p className="text-center font-body text-xs text-[#fdfaf1]/30 pt-2 pb-6">
          Riservato a Nicolas e Giulia · La passphrase non è mai salvata nel bundle del sito
        </p>
      </main>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  sub,
  color,
  highlight,
}: {
  icon: ReactNode;
  label: string;
  value: number;
  sub?: string;
  color: string;
  highlight?: boolean;
}) {
  return (
    <div
      className="rounded-sm p-3 sm:p-4 transition-colors"
      style={{
        background: highlight ? `color-mix(in srgb, ${color} 8%, #fdfaf1)` : '#fdfaf1',
        border: `1px solid ${highlight ? `${color}50` : 'rgba(212,175,55,0.3)'}`,
      }}
    >
      <div className="flex items-center gap-1.5 mb-1">
        <span
          className="w-6 h-6 rounded-full grid place-items-center"
          style={{ background: highlight ? color : 'transparent' }}
        >
          {icon}
        </span>
        <span className="font-cinzel text-[0.6rem] uppercase tracking-widest"
          style={{ color: highlight ? color : `${color}99` }}
        >
          {label}
        </span>
      </div>
      <p
        className="font-cinzel font-light tabular-nums leading-none"
        style={{ fontSize: '1.75rem', color }}
      >
        {value}
      </p>
      {sub && (
        <p className="font-body text-[0.66rem] mt-1"
          style={{ color: `${color}99` }}
        >
          {sub}
        </p>
      )}
    </div>
  );
}

function SevenDaysChart({ days }: { days: { date: string; count: number }[] }) {
  const max = Math.max(1, ...days.map((d) => d.count));
  return (
    <div className="flex items-end justify-between gap-1.5 h-24">
      {days.map((d) => {
        const heightPct = d.count === 0 ? 4 : Math.max(8, (d.count / max) * 100);
        const dayLabel = new Date(d.date + 'T00:00:00').toLocaleDateString('it-IT', {
          weekday: 'narrow',
        });
        return (
          <div
            key={d.date}
            className="flex flex-col items-center gap-1 flex-1"
            title={`${d.date}: ${d.count} RSVP`}
          >
            <span className="font-cinzel text-[0.6rem] tabular-nums text-[#1a4a2e]/60">
              {d.count > 0 ? d.count : '·'}
            </span>
            <div
              className="w-full rounded-t-sm transition-all"
              style={{
                height: `${heightPct}%`,
                background: d.count > 0
                  ? 'linear-gradient(to top, #1a4a2e, #1a4a2eCC)'
                  : 'rgba(26,74,46,0.1)',
                minHeight: '4px',
              }}
            />
            <span className="font-cinzel text-[0.6rem] uppercase text-[#1a4a2e]/50">
              {dayLabel}
            </span>
          </div>
        );
      })}
    </div>
  );
}
