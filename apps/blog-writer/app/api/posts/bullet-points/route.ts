import { NextResponse } from 'next/server';

import { z } from 'zod';

import { enhanceRouteHandler } from '@kit/next/routes';
import { getLogger } from '@kit/shared/logger';
import { getSupabaseRouteHandlerClient } from '@kit/supabase/route-handler-client';

import { createPostsLLMService } from '~/home/(user)/posts/_lib/server/posts-llm.service';
import { createTokenUsageTrackerService } from '~/home/(user)/posts/_lib/server/token-usage-tracker.service';

const Schema = z.object({
  title: z.string().min(1),
  outline: z.array(
    z.object({
      heading: z.string().min(1),
      sections: z.array(
        z.object({
          value: z.string().min(1),
        }),
      ),
    }),
  ),
});

const ESTIMATED_TOKENS_USAGE = 1000;

export const POST = enhanceRouteHandler(
  async ({ body, user }) => {
    const service = createPostsLLMService();
    const logger = await getLogger();

    const tokensTracker = createTokenUsageTrackerService(
      getSupabaseRouteHandlerClient({ admin: true }),
      user.id,
    );

    const { data: remainingTokens, error } = await tokensTracker.consumeTokens(
      ESTIMATED_TOKENS_USAGE,
    );

    if (error) {
      logger.error(
        {
          error,
          userId: user.id,
        },
        `Error consuming tokens.`,
      );

      return NextResponse.error();
    }

    try {
      const { tokens, content } = await service.generateBulletPoints(
        body.title,
        body.outline,
      );

      await tokensTracker.updateOrganizationTokens({
        tokensUsed: tokens,
        remainingTokens,
        estimatedTokensUsage: ESTIMATED_TOKENS_USAGE,
      });

      return NextResponse.json(content);
    } catch (e) {
      logger.error(
        {
          error: e,
          userId: user.id,
        },
        `Error generating bullet points.`,
      );

      await tokensTracker.rollbackTokensCount(
        remainingTokens,
        ESTIMATED_TOKENS_USAGE,
      );

      return NextResponse.error();
    }
  },
  {
    schema: Schema,
  },
);
