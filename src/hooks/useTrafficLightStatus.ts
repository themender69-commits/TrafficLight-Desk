import { useCallback, useEffect, useRef, useState } from 'react';
import type { StatusPayload } from '../types';
import { API_BASE, DEFAULT_STATUS } from '../types';

const POLL_FALLBACK_MS = 2000;

async function fetchStatus(): Promise<StatusPayload> {
  try {
    const res = await fetch(`${API_BASE}/status`);
    if (res.ok) {
      return (await res.json()) as StatusPayload;
    }
  } catch {
    /* server not running */
  }
  return DEFAULT_STATUS;
}

export function useTrafficLightStatus() {
  const [status, setStatus] = useState<StatusPayload>(DEFAULT_STATUS);
  const esRef = useRef<EventSource | null>(null);

  const refresh = useCallback(() => {
    fetchStatus().then(setStatus);
  }, []);

  useEffect(() => {
    refresh();

    let es: EventSource | null = null;
    try {
      es = new EventSource(`${API_BASE}/events`);
      esRef.current = es;
      es.addEventListener('status', (ev) => {
        try {
          setStatus(JSON.parse((ev as MessageEvent).data) as StatusPayload);
        } catch {
          /* ignore */
        }
      });
      es.onerror = () => {
        /* EventSource reconnects; fallback poll below */
      };
    } catch {
      /* no SSE */
    }

    const timer = setInterval(refresh, POLL_FALLBACK_MS);
    return () => {
      clearInterval(timer);
      es?.close();
      esRef.current = null;
    };
  }, [refresh]);

  return { ...status, refresh };
}
