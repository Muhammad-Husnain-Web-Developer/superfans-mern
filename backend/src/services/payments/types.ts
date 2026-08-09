/**
 * Payment-provider abstraction. Every gateway (Stripe today; PayPal / Verotel / Redsys
 * later) implements this one interface, and the app is wired only to the interface — so
 * switching gateways is a new adapter file + the PAYMENT_PROVIDER env var, nothing more.
 *
 * The model is "hosted checkout + redirect": the provider returns a URL we send the
 * browser to; the gateway takes the payment on its own page and calls our webhook. This
 * is the safest common denominator and matches how Stripe Checkout, PayPal, Verotel and
 * Redsys all work.
 */

export type CheckoutMode = 'subscription' | 'payment';

export interface CheckoutRequest {
  mode: CheckoutMode;
  /** amount in major currency units (e.g. euros), used for one-time or as the recurring price */
  amount: number;
  currency: string;
  description: string;
  /** recurring interval for subscription mode */
  interval?: 'month';
  customerEmail?: string;
  /** carried through to the webhook so we know what the payment was for */
  metadata: Record<string, string>;
  successUrl: string;
  cancelUrl: string;
}

export interface CheckoutResult {
  /** where to send the browser to complete payment */
  url: string;
  /** the provider's session/order id, for verify-on-return */
  reference: string;
}

export type WebhookEventType =
  | 'checkout.completed'
  | 'subscription.renewed'
  | 'subscription.cancelled'
  | 'payment.failed'
  | 'unknown';

export interface WebhookEvent {
  type: WebhookEventType;
  /** provider subscription id, when relevant */
  subscriptionId?: string;
  /** provider checkout session/reference id, for idempotent one-time reconciliation */
  reference?: string;
  metadata: Record<string, string>;
}

export interface PaymentProvider {
  readonly name: string;
  /** true when credentials are configured */
  readonly ready: boolean;
  createCheckout(req: CheckoutRequest): Promise<CheckoutResult>;
  /** verify a completed checkout on the success redirect (belt-and-braces with the webhook) */
  verifyCheckout(reference: string): Promise<{ paid: boolean; metadata: Record<string, string> }>;
  cancelSubscription(externalId: string): Promise<void>;
  /** parse + verify an incoming webhook; throws on a bad signature */
  parseWebhook(rawBody: Buffer, signature: string | undefined): WebhookEvent;
}
