import { useCallback, useEffect, useState } from 'react';
import type { StatusPayload } from '../types';
import { API_BASE, DEFAULT_STATUS } from '../types';

const POLL_MS = 400;

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

  const refresh = useCallback(() => {
    fetchStatus().then(setStatus);
  }, []);

  useEffect(() => {
    refresh();
    const timer = setInterval(refresh, POLL_MS);
    return () => clearInterval(timer);
  }, [refresh]);

  return { ...status, refresh };
}
