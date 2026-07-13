import { useEffect } from 'react';

import { notifyUserError } from '../features/account/authStore';

const notifiedErrors = new WeakSet<object>();

export function useQueryErrorNotification(error: unknown) {
  useEffect(() => {
    if (!error) return;
    if (typeof error === 'object') {
      if (notifiedErrors.has(error)) return;
      notifiedErrors.add(error);
    }
    notifyUserError(error);
  }, [error]);
}
