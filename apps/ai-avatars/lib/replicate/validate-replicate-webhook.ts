import { NextRequest } from 'next/server';

import { createHmac } from 'crypto';

const REPLICATE_WEBHOOK_SECRET_URL =
  'https://api.replicate.com/v1/webhooks/default/secret';
const REPLICATE_API_TOKEN = process.env.REPLICATE_API_TOKEN;

if (!REPLICATE_API_TOKEN) {
  throw new Error('REPLICATE_API_TOKEN is not set');
}

let cachedSecret: string | null = null;

/**
 * @name validateReplicateWebhook
 * @param req
 */
export async function validateReplicateWebhook(req: NextRequest) {
  const body = await req.clone().text();
  const headers = req.headers;
  const webhookId = headers.get('webhook-id');
  const webhookTimestamp = headers.get('webhook-timestamp');
  const signature = headers.get('webhook-signature') ?? '';
  const secret = await fetchReplicateWebhookSecret();

  const signedContent = `${webhookId}.${webhookTimestamp}.${body}`;
  const secretBytes = new Buffer(secret.split('_')[1]!, 'base64');

  const computedSignature = createHmac('sha256', secretBytes)
    .update(signedContent)
    .digest('base64');

  const expectedSignatures = signature
    .split(' ')
    .map((sig) => sig.split(',')[1]);
  const isValid = expectedSignatures.some(
    (expectedSignature) => expectedSignature === computedSignature,
  );

  if (!isValid) {
    throw new Error('Invalid signature');
  }
}

async function fetchReplicateWebhookSecret() {
  if (cachedSecret) {
    return cachedSecret;
  }

  const response = await fetch(REPLICATE_WEBHOOK_SECRET_URL, {
    headers: {
      Authorization: `Token ${REPLICATE_API_TOKEN}`,
    },
  });

  const json = await response.json();

  cachedSecret = json.key;

  if (!cachedSecret) {
    throw new Error('Replicate secret not found');
  }

  return cachedSecret;
}
