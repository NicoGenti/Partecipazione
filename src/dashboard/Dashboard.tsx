import { useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import DashboardLogin from './DashboardLogin';
import DashboardView from './DashboardView';
import {
  fetchDashboard,
  getStoredAdminKey,
  setStoredAdminKey,
  clearStoredAdminKey,
} from './apiClient';
import type { DashboardReply } from './types';

type Phase = 'login' | 'loading' | 'ready' | 'error';

interface Props {
  onExit: () => void;
}

export default function Dashboard({ onExit }: Props) {
  const [phase, setPhase] = useState<Phase>('login');
  const [data, setData] = useState<DashboardReply | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // All'apertura, se c'è già una key in sessionStorage prova a caricare direttamente.
  useEffect(() => {
    const stored = getStoredAdminKey();
    if (stored && stored.length > 0) {
      void load(stored);
    }
    return () => abortRef.current?.abort();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function load(key: string): Promise<void> {
    setPhase('loading');
    setError(null);
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    try {
      const reply = await fetchDashboard(key, ac.signal);
      setStoredAdminKey(key);
      setData(reply);
      setPhase('ready');
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return;
      setPhase('login');
      setError(e instanceof Error ? e.message : 'Errore sconosciuto.');
      clearStoredAdminKey();
    }
  }

  function handleLogout(): void {
    clearStoredAdminKey();
    abortRef.current?.abort();
    setData(null);
    setError(null);
    setPhase('login');
  }

  if (phase === 'loading' || (phase === 'ready' && !data)) {
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center gap-3"
        style={{ background: '#0c0d12' }}
      >
        <Loader2 size={28} className="text-[#d4af37] animate-spin" />
        <p className="font-cinzel text-xs uppercase tracking-widest text-[#fdfaf1]/70">
          Sto evocando la dashboard…
        </p>
      </div>
    );
  }

  if (phase === 'error' || (phase === 'login' && !data)) {
    return (
      <DashboardLogin
        onSubmit={(key) => void load(key)}
        onBack={onExit}
        initialError={error}
        isLoading={false}
      />
    );
  }

  if (phase === 'ready' && data) {
    return (
      <DashboardView
        data={data}
        onLogout={handleLogout}
        onRefresh={() => {
          const k = getStoredAdminKey();
          if (k) void load(k);
        }}
        isRefreshing={false}
      />
    );
  }

  // Stato non raggiungibile — fallback sicuro.
  return (
    <DashboardLogin
      onSubmit={(key) => void load(key)}
      onBack={onExit}
      initialError={error}
    />
  );
}