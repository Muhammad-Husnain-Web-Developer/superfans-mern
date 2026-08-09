import { env } from '../../config/env.js';
import type { PaymentProvider } from './types.js';
import { StripeProvider } from './stripe.js';

/**
 * The active payment provider, chosen by PAYMENT_PROVIDER. To add PayPal/Verotel/Redsys
 * later, implement PaymentProvider in a new file and register it here — nothing else in
 * the app changes.
 */
function build(): PaymentProvider {
  switch (env.PAYMENT_PROVIDER) {
    case 'stripe':
    default:
      return new StripeProvider();
  }
}

export const paymentProvider = build();
export * from './types.js';
