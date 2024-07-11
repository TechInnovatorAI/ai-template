import { getBillingEventHandlerService } from '@kit/billing-gateway';
import { enhanceRouteHandler } from '@kit/next/routes';
import { getLogger } from '@kit/shared/logger';
import { getSupabaseRouteHandlerClient } from '@kit/supabase/route-handler-client';

import billingConfig from '~/config/billing.config';
import { Database } from '~/lib/database.types';

/**
 * @description Handle the webhooks from Stripe related to checkouts
 */
export const POST = enhanceRouteHandler(
  async ({ request }) => {
    const provider = billingConfig.provider;
    const logger = await getLogger();

    const ctx = {
      name: 'billing.webhook',
      provider,
    };

    logger.info(ctx, `Received billing webhook. Processing...`);

    const supabaseClientProvider = () =>
      getSupabaseRouteHandlerClient<Database>({ admin: true });

    const service = await getBillingEventHandlerService(
      supabaseClientProvider,
      provider,
      billingConfig,
    );

    try {
      await service.handleWebhookEvent(request, {
        onInvoicePaid: async (data) => {
          const accountId = data.target_account_id;
          const lineItems = data.line_items;

          // we only expect one line item in the invoice
          // if you add more than one, you need to handle that here
          // by finding the correct line item to get the variant ID
          const variantId = lineItems[0]?.variant_id;

          if (!variantId) {
            logger.error(
              {
                accountId,
              },
              'Variant ID not found in line items',
            );

            throw new Error('Variant ID not found in invoice');
          }

          await updateMessagesCountQuota({
            variantId,
            accountId,
          });
        },
      });

      logger.info(ctx, `Successfully processed billing webhook`);

      return new Response('OK', { status: 200 });
    } catch (error) {
      logger.error({ ...ctx, error }, `Failed to process billing webhook`);

      return new Response('Failed to process billing webhook', {
        status: 500,
      });
    }
  },
  {
    auth: false,
  },
);

async function updateMessagesCountQuota(params: {
  variantId: string;
  accountId: string;
}) {
  const client = getSupabaseRouteHandlerClient<Database>({ admin: true });

  // get the max messages for the price based on the price ID
  const plan = await client
    .from('plans')
    .select('tokens_quota')
    .eq('variant_id', params.variantId)
    .single();

  if (plan.error) {
    throw plan.error;
  }

  const { tokens_quota } = plan.data;

  // upsert the message count for the account
  // and set the period start and end dates (from the subscription)
  const response = await client
    .from('credits_usage')
    .update({
      tokens_quota,
    })
    .eq('account_id', params.accountId);

  if (response.error) {
    throw response.error;
  }
}
