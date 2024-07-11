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
        async onInvoicePaid(data) {
          const logger = await getLogger();

          const subscriptionId = data.target_subscription_id;
          const accountId = data.target_account_id;
          const lineItems = data.line_items;

          // we only expect one line item in the invoice
          // if you add more than one, you need to handle that here
          // by finding the correct line item to get the variant ID
          const variantId = lineItems[0]?.variant_id;

          if (!variantId) {
            logger.error(
              {
                subscriptionId,
                accountId,
              },
              'Variant ID not found in invoice',
            );

            throw new Error('Variant ID not found in invoice');
          }

          await updateCreditsQuota({
            subscriptionId,
            accountId,
            variantId,
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

async function updateCreditsQuota(params: {
  subscriptionId: string;
  accountId: string;
  variantId: string;
}) {
  const client = getSupabaseRouteHandlerClient<Database>({ admin: true });
  const logger = await getLogger();

  const { subscriptionId, accountId, variantId } = params;

  logger.info(
    {
      subscriptionId,
    },
    'Updating messages count quota',
  );

  // get the max messages for the price based on the price ID
  const plan = await client
    .from('plans')
    .select('max_messages, max_documents')
    .eq('variant_id', variantId)
    .single();

  if (plan.error) {
    logger.error(
      {
        error: plan.error,
        variantId,
        subscriptionId,
      },
      'Failed to retrieve the plan',
    );

    throw plan.error;
  }

  // upsert the message count for the organization
  // and set the period start and end dates (from the subscription)
  const response = await client
    .from('account_usage')
    .update({
      messages_quota: plan.data.max_messages,
      documents_quota: plan.data.max_documents,
    })
    .eq('account_id', accountId);

  if (response.error) {
    logger.error(
      {
        error: response.error,
        accountId,
        subscriptionId,
        plan,
      },
      'Failed to update messages count quota',
    );

    throw response.error;
  }

  logger.info(
    {
      accountId,
      subscriptionId,
      plan,
    },
    'Updated messages count quota',
  );
}
