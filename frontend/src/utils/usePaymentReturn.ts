import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import confetti from 'canvas-confetti';
import { api } from '../api/client';

/** what the page gets back: whether the money went through, and the line to show. */
export interface PaymentReturn {
  ok: boolean;
  message: string;
}

/**
 * The confetti of user_profile.blade.php:820-833, particle for particle.
 *
 * The blade fires it on any `message_subscription`, which in Laravel is also set when a
 * subscription *fails* ("The subscription has not proceeded successfully.") and when one is
 * deleted — so the original celebrates those too. The client asked for it "when subscription
 * positive payment", so it is fired here only once the payment is confirmed paid.
 */
function celebrate(): void {
  confetti({ particleCount: 200, spread: 100, origin: { y: 0.6 } });
}

/**
 * Reconciles a payment when the gateway redirects back with
 * `?payment=success&session_id=...`. Calls the verify endpoint (belt-and-braces with the
 * webhook), strips the query params, and returns the outcome for the page to show.
 *
 * `ok` is the flag the callers branch on. It used to be read out of the message with
 * `.includes('successful')`, which worked only while that message was English — the moment
 * it was translated the check would have gone quietly false, taking the success icon, and
 * now the confetti, with it.
 */
export function usePaymentReturn(onReconciled?: () => void): PaymentReturn | null {
  const { t: tUi } = useTranslation('ui');
  const [result, setResult] = useState<PaymentReturn | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const outcome = params.get('payment');
    if (!outcome) return;

    const clean = () => {
      const url = new URL(window.location.href);
      /* `chat` rides back with the premium return and has already been read by the page that
         wanted it; it goes out with the rest so a reload is a plain profile again. */
      ['payment', 'session_id', 'chat'].forEach((k) => url.searchParams.delete(k));
      window.history.replaceState({}, '', url.pathname + url.search);
    };

    if (outcome === 'cancelled') {
      setResult({ ok: false, message: tUi('payment_cancelled') });
      clean();
      return;
    }

    const sessionId = params.get('session_id');
    if (outcome === 'success' && sessionId) {
      api
        .get<{ paid: boolean }>(`/payments/verify/${sessionId}`)
        .then(({ data }) => {
          setResult({
            ok: data.paid,
            message: data.paid ? tUi('payment_success') : tUi('payment_processing'),
          });
          if (data.paid) {
            celebrate();
            onReconciled?.();
          }
        })
        .catch(() => setResult({ ok: false, message: tUi('payment_unconfirmed') }))
        .finally(clean);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return result;
}
