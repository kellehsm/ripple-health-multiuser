import { useCallback, useEffect, useState } from 'react';
import { TabPreferences, DEFAULT_TAB_PREFERENCES } from '../types/tabPreferences';
import { api } from '../api/client';

interface UseTabPreferencesResult {
  preferences: TabPreferences;
  loading: boolean;
  error: string | null;
  save: (next: TabPreferences) => Promise<void>;
}

export function useTabPreferences(): UseTabPreferencesResult {
  const [preferences, setPreferences] = useState<TabPreferences>(DEFAULT_TAB_PREFERENCES);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        const data = (await api.getTabPreferences()) as TabPreferences;
        if (!cancelled) setPreferences(data);
      } catch (err: any) {
        if (!cancelled) {
          const msg: string = err?.message ?? '';
          // 404 = new user with no saved preferences — silently use defaults
          if (!msg.includes('404')) {
            setError(msg || 'Unknown error');
          }
          setPreferences(DEFAULT_TAB_PREFERENCES);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, []);

  const save = useCallback(async (next: TabPreferences) => {
    setPreferences(next); // optimistic
    try {
      await api.putTabPreferences(next);
    } catch (err: any) {
      setError(err?.message ?? 'Unknown error');
    }
  }, []);

  return { preferences, loading, error, save };
}
