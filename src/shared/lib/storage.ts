import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from './supabaseClient';
import { getSession } from './auth';

export function uid(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export async function loadNamespaced<T>(namespace: string, fallback: T): Promise<T> {
  const { data, error } = await supabase.from('app_data').select('data').eq('namespace', namespace).maybeSingle();
  if (error || !data) return fallback;
  return data.data as T;
}

export async function saveNamespaced<T>(namespace: string, data: T): Promise<void> {
  const session = getSession();
  const { error } = await supabase
    .from('app_data')
    .upsert({ namespace, data: data as unknown as object, updated_by: session?.username ?? null });
  if (error) throw error;
}

/**
 * Shared read/write hook for a whole feature module's data — the direct
 * successor to the old localStorage-backed version, same external shape
 * ([data, update]) so pages built against it barely had to change.
 *
 * - Loads once on mount.
 * - Subscribes to Postgres changes on this namespace's row, so an edit made
 *   on someone else's phone or laptop shows up here within about a second,
 *   without a manual refresh — this is what makes "10-15 people on
 *   different devices" actually work day to day.
 * - `update` applies the change to local state immediately (so the UI never
 *   waits on the network) and saves in the background. A page that calls
 *   `update(...)` and then immediately navigates away (e.g. after Issue
 *   Equipment) is safe — the write is already in flight against a ref, not
 *   trapped inside a React state updater that a route change could abandon.
 * - If the background save fails (offline, RLS denial, etc.) it's logged to
 *   the console rather than surfaced in the UI yet — see DEPLOYMENT_PLAN.md
 *   "Known limitations" for why, and what to add if this becomes a problem
 *   in practice.
 */
export function useNamespacedData<T>(namespace: string, empty: T) {
  const [data, setDataState] = useState<T>(empty);
  const dataRef = useRef<T>(empty);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const loaded = await loadNamespaced<T>(namespace, empty);
      if (cancelled) return;
      dataRef.current = loaded;
      setDataState(loaded);
    })();

    const channel = supabase
      .channel(`app_data:${namespace}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'app_data', filter: `namespace=eq.${namespace}` },
        (payload) => {
          const next = payload.new.data as T;
          dataRef.current = next;
          setDataState(next);
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [namespace]);

  const update = useCallback(
    (updater: (prev: T) => T) => {
      const next = updater(dataRef.current);
      dataRef.current = next;
      setDataState(next);
      saveNamespaced(namespace, next).catch((err) => {
        console.error(`[caretrack] failed to save "${namespace}":`, err);
      });
    },
    [namespace]
  );

  return [data, update] as const;
}
