import { useEffect, useState } from 'react';
import { api } from '../api/client';

/**
 * Reconciles a payment when the gateway redirects back with
 * `?payment=success&session_id=...`. Calls the verify endpoint (belt-and-braces with the
 * webhook), strips the query params, and returns a one-line status the page can show.
 */
export function usePaymentReturn(onReconciled?: () => void): string | null {
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const outcome = params.get('payment');
    if (!outcome) return;

    const clean = () => {
      const url = new URL(window.location.href);
      ['payment', 'session_id'].forEach((k) => url.searchParams.delete(k));
      window.history.replaceState({}, '', url.pathname + url.search);
    };

    if (outcome === 'cancelled') {
      setStatus('Payment cancelled — no charge was made.');
      clean();
      return;
    }

    const sessionId = params.get('session_id');
    if (outcome === 'success' && sessionId) {
      api
        .get<{ paid: boolean }>(`/payments/verify/${sessionId}`)
        .then(({ data }) => {
          setStatus(data.paid ? 'Payment successful — thank you!' : 'Payment is being processed…');
          if (data.paid) onReconciled?.();
        })
        .catch(() => setStatus('We could not confirm the payment yet.'))
        .finally(clean);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return status;
}
