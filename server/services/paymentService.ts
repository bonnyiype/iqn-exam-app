import { HttpError } from '../middleware/licenseAuth.js';
import { log, logError } from '../utils/logger.js';

const STRIPE_SECRET = process.env.STRIPE_SECRET_KEY?.trim();
const DEFAULT_PRICE = process.env.STRIPE_PRICE_ID?.trim();

export interface CheckoutSessionInput {
  licenseId: string;
  successUrl: string;
  cancelUrl: string;
  priceId?: string;
  customerEmail?: string;
  quantity?: number;
  mode?: 'payment' | 'subscription';
}

export interface CheckoutSessionResponse {
  id: string;
  url?: string;
}

export async function createCheckoutSession(
  input: CheckoutSessionInput
): Promise<CheckoutSessionResponse> {
  if (!STRIPE_SECRET) {
    throw new HttpError(500, 'Stripe integration is not configured.');
  }

  const priceId = (input.priceId || DEFAULT_PRICE || '').trim();
  if (!priceId) {
    throw new HttpError(400, 'A Stripe price ID must be provided.');
  }

  const params = new URLSearchParams();
  params.set('mode', input.mode ?? 'payment');
  params.set('success_url', input.successUrl);
  params.set('cancel_url', input.cancelUrl);
  params.set('line_items[0][price]', priceId);
  params.set('line_items[0][quantity]', String(input.quantity ?? 1));
  params.set('metadata[licenseId]', input.licenseId);
  if (input.customerEmail) {
    params.set('customer_email', input.customerEmail);
  }

  try {
    const response = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${STRIPE_SECRET}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: params.toString()
    });

    const data = await response.json() as { id?: string; url?: string; error?: { message?: string } };
    if (!response.ok) {
      const message = data.error?.message || 'Unable to create Stripe checkout session.';
      throw new HttpError(response.status, message);
    }

    if (!data.id) {
      throw new HttpError(502, 'Stripe did not return a checkout session identifier.');
    }

    log('info', 'Created Stripe checkout session', { licenseId: input.licenseId, sessionId: data.id });
    return { id: data.id, url: data.url };
  } catch (error) {
    logError(error, { licenseId: input.licenseId, scope: 'stripe.checkout' });
    if (error instanceof HttpError) {
      throw error;
    }
    throw new HttpError(502, 'Unexpected error while talking to Stripe.');
  }
}
