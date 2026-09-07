'use client';
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { WardynState } from '../server/store';

type WorkspaceContext = {
  state: WardynState | null;
  busy: boolean;
  error: string | null;
  mutate: (body: unknown) => Promise<void>;
  request: <T>(body: unknown) => Promise<T>;
  reload: () => Promise<void>;
};
const Context = createContext<WorkspaceContext | null>(null);
export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<WardynState | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const locked = useRef(false);
  const reload = useCallback(async () => {
    try {
      const res = await fetch('/api/wardyn');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setState(data);
      setError(null);
    } catch {
      setError('Wardyn could not load your session. Check the server and retry.');
    }
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/wardyn', { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error('Session unavailable');
        const data: WardynState = await response.json();
        setState(data);
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setError('Wardyn could not load your session. Check the server and retry.');
      });
    return () => controller.abort();
  }, []);
  const request = useCallback(async <T,>(body: unknown): Promise<T> => {
    const response = await fetch('/api/wardyn', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error ?? 'Request failed');
    return data as T;
  }, []);
  const mutate = useCallback(
    async (body: unknown) => {
      if (locked.current) return;
      locked.current = true;
      setBusy(true);
      setError(null);
      try {
        setState(await request<WardynState>(body));
      } catch (e) {
        setError(e instanceof Error ? e.message : 'The operation failed.');
      } finally {
        setBusy(false);
        locked.current = false;
      }
    },
    [request],
  );
  useEffect(() => {
    if (!state?.monitoring) return;
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') void mutate({ command: 'scan' });
    }, 30000);
    return () => clearInterval(timer);
  }, [state?.monitoring, mutate]);
  return (
    <Context.Provider value={{ state, busy, error, mutate, request, reload }}>
      {children}
    </Context.Provider>
  );
}
export function useWorkspace() {
  const context = useContext(Context);
  if (!context) throw new Error('Workspace context missing');
  return context;
}
