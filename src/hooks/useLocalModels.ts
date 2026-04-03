import { useEffect, useState } from 'react';
import { fetchModelsCatalog, type ModelsApiResponse } from '@/utils/localModelDiscovery';

export function useLocalModels(pollMs = 30000) {
  const [data, setData] = useState<ModelsApiResponse | null>(null);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      const r = await fetchModelsCatalog();
      if (!cancelled) setData(r);
    };
    run();
    const t = setInterval(run, pollMs);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [pollMs]);

  return data;
}
