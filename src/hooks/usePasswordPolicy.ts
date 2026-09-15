import { useEffect, useState } from 'react';

import { getPasswordPolicy } from '@/api/auth';
import type { PasswordPolicy } from '@/api/auth';

const DEFAULT_POLICY: PasswordPolicy = { min_length: 8, max_length: 50 };

export function usePasswordPolicy() {
  const [policy, setPolicy] = useState<PasswordPolicy>(DEFAULT_POLICY);

  useEffect(() => {
    let cancelled = false;
    getPasswordPolicy()
      .then((res) => {
        if (!cancelled) setPolicy(res);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  return policy;
}
