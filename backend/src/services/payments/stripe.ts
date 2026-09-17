import Stripe from 'stripe';
import { env } from '../../config/env.js';
import type { CheckoutRequest, CheckoutResult, PaymentProvider, WebhookEvent } from './types.js';

/**
 * Stripe adapter — implements PaymentProvider with Stripe Checkout Sessions.
 * Prices are created inline (price_data) so no dashboard product setup is needed;
 * recurring subscriptions are handled by Stripe itself (renewals arrive as webhooks),
 * which removes the recurring-charge cron the Redsys path would have needed.
 */
export class StripeProvider implements PaymentProvider {
  readonly name = 'stripe';
  private stripe: Stripe | null;

  constructor() {
    this.stripe = env.STRIPE_SECRET_KEY ? new Stripe(env.STRIPE_SECRET_KEY) : null;
  }

  get ready(): boolean {
    return this.stripe !== null;
  }

  async createCheckout(req: CheckoutRequest): Promise<CheckoutResult> {
    if (!this.stripe) throw new Error('Stripe is not configured');
    const unitAmount = Math.round(req.amount * 100); // cents

    const priceData: Stripe.Checkout.SessionCreateParams.LineItem.PriceData = {
      currency: req.currency.toLowerCase(),
      unit_amount: unitAmount,
      product_data: { name: req.description },
      ...(req.mode === 'subscription'
        ? { recurring: { interval: req.interval ?? 'month' } }
        : {}),
    };

    const session = await this.stripe.checkout.sessions.create({
      mode: req.mode,
      line_items: [{ price_data: priceData, quantity: 1 }],
      customer_email: req.customerEmail,
      metadata: req.metadata,
      // subscription metadata rides on the subscription object too, for renewal webhooks
      ...(req.mode === 'subscription' ? { subscription_data: { metadata: req.metadata } } : {}),
      success_url: req.successUrl,
      cancel_url: req.cancelUrl,
    });

    return { url: session.url!, reference: session.id };
  }

  async verifyCheckout(reference: string): Promise<{ paid: boolean; metadata: Record<string, string> }> {
    if (!this.stripe) throw new Error('Stripe is not configured');
    const session = await this.stripe.checkout.sessions.retrieve(reference);
    const paid = session.payment_status === 'paid' || session.status === 'complete';
    return { paid, metadata: (session.metadata ?? {}) as Record<string, string> };
  }

  async cancelSubscription(externalId: string): Promise<void> {
    if (!this.stripe) throw new Error('Stripe is not configured');
    await this.stripe.subscriptions.cancel(externalId);
  }

  /**
   * `proration_behavior: 'none'` is what makes this take effect on the *next* invoice only:
   * Stripe swaps the subscription item's price but neither charges nor credits anything for
   * the time already elapsed in the current period, so nothing is billed today.
   *
   * Unlike a Checkout Session's line item, a subscription item's `price_data` cannot create
   * a Product inline — it takes an existing product id. The one made when this subscription
   * was first checked out is still sitting on the item's current price, so it is reused
   * rather than standing up a Stripe Product/Price catalogue just for this.
   */
  async updateSubscriptionPrice(externalId: string, amount: number, currency: string): Promise<void> {
    if (!this.stripe) throw new Error('Stripe is not configured');
    const sub = await this.stripe.subscriptions.retrieve(externalId);
    const item = sub.items.data[0];
    if (!item) return;
    const productId = typeof item.price.product === 'string' ? item.price.product : item.price.product.id;
    await this.stripe.subscriptions.update(externalId, {
      items: [
        {
          id: item.id,
          price_data: {
            currency: currency.toLowerCase(),
            unit_amount: Math.round(amount * 100),
            recurring: { interval: 'month' },
            product: productId,
          },
        },
      ],
      proration_behavior: 'none',
    });
  }

  parseWebhook(rawBody: Buffer, signature: string | undefined): WebhookEvent {
    if (!this.stripe) throw new Error('Stripe is not configured');
    if (!env.STRIPE_WEBHOOK_SECRET || !signature) {
      throw new Error('Webhook secret or signature missing');
    }
    const event = this.stripe.webhooks.constructEvent(rawBody, signature, env.STRIPE_WEBHOOK_SECRET);

    switch (event.type) {
      case 'checkout.session.completed': {
        const s = event.data.object as Stripe.Checkout.Session;
        return {
          type: 'checkout.completed',
          subscriptionId: typeof s.subscription === 'string' ? s.subscription : undefined,
          reference: s.id,
          metadata: (s.metadata ?? {}) as Record<string, string>,
        };
      }
      case 'invoice.paid': {
        const inv = event.data.object as Stripe.Invoice;
        const sub = (inv as unknown as { subscription?: string }).subscription;
        return {
          type: 'subscription.renewed',
          subscriptionId: typeof sub === 'string' ? sub : undefined,
          metadata: (inv.metadata ?? {}) as Record<string, string>,
        };
      }
      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription;
        return {
          type: 'subscription.cancelled',
          subscriptionId: sub.id,
          metadata: (sub.metadata ?? {}) as Record<string, string>,
        };
      }
      case 'invoice.payment_failed': {
        const inv = event.data.object as Stripe.Invoice;
        const sub = (inv as unknown as { subscription?: string }).subscription;
        return {
          type: 'payment.failed',
          subscriptionId: typeof sub === 'string' ? sub : undefined,
          metadata: (inv.metadata ?? {}) as Record<string, string>,
        };
      }
      default:
        return { type: 'unknown', metadata: {} };
    }
  }
}
