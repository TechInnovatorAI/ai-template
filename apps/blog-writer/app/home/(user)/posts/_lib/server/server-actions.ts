'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { z } from 'zod';

import { enhanceAction } from '@kit/next/actions';
import { getLogger } from '@kit/shared/logger';
import { getSupabaseServerActionClient } from '@kit/supabase/server-actions-client';

import { createPostsLLMService } from '~/home/(user)/posts/_lib/server/posts-llm.service';
import { createTokenUsageTrackerService } from '~/home/(user)/posts/_lib/server/token-usage-tracker.service';
import { Database } from '~/lib/database.types';

const GeneratePostSchema = z.object({
  title: z.string().min(1),
  outline: z.array(
    z.object({
      heading: z.string().min(1),
      sections: z.array(
        z.object({
          value: z.string().min(1),
          bulletPoints: z.array(
            z.object({
              value: z.string().min(1),
            }),
          ),
        }),
      ),
    }),
  ),
});

export const generatePostAction = enhanceAction(
  async (body, user) => {
    const logger = await getLogger();

    const service = createPostsLLMService();
    const adminClient = getSupabaseServerActionClient<Database>({
      admin: true,
    });

    logger.info(
      {
        accountId: user.id,
        title: body.title,
      },
      `Generating post...`,
    );

    const { outline, title } = GeneratePostSchema.parse(body);

    const tokensTracker = createTokenUsageTrackerService(adminClient, user.id);

    // subtract the estimated tokens usage from the organization's tokens count
    const { data: remainingTokens, error } = await tokensTracker.consumeTokens(
      tokensTracker.estimateTokensCountFromData(outline),
    );

    if (error) {
      logger.error(
        {
          accountId: user.id,
          error,
        },
        `Failed to consume tokens`,
      );

      throw new Error(`Failed to consume tokens`);
    }

    // generate the post using the LLM
    const { content, tokens, success } = await service.generatePost(
      title,
      outline,
    );

    if (success) {
      logger.info(
        {
          tokens,
        },
        `Post successfully generated`,
      );
    } else {
      logger.error(
        {
          tokens,
        },
        `Failed to generate post. Reverse the tokens count...`,
      );

      // if the post generation failed, we need to reverse the tokens count
      // by adding the estimated tokens usage back to the organization's tokens count
      await tokensTracker.rollbackTokensCount(
        remainingTokens,
        tokensTracker.estimateTokensCountFromData(outline),
      );

      throw new Error(`Failed to generate post.`);
    }

    const insertPostResponse = await adminClient
      .from('posts')
      .insert({
        title,
        content,
        account_id: user.id,
      })
      .select('id')
      .single();

    if (insertPostResponse.error) {
      throw new Error(insertPostResponse.error.message);
    }

    // once the post is generated, we can update the organization's tokens
    // count with the actual amount used
    try {
      logger.info(
        {
          account: user.id,
          tokens,
        },
        `Updating organization's tokens count...`,
      );

      await tokensTracker.updateOrganizationTokens({
        tokensUsed: tokens,
        remainingTokens,
        estimatedTokensUsage:
          tokensTracker.estimateTokensCountFromData(outline),
      });

      logger.info(
        {
          accountId: user.id,
          tokens,
        },
        `Organization's tokens count successfully updated`,
      );
    } catch (e) {
      logger.error(
        {
          accountId: user.id,
          error: e,
        },
        `Failed to update organization's tokens count`,
      );
    }

    const id = insertPostResponse.data.id;

    return redirect(`/home/posts/${id}`);
  },
  {
    schema: GeneratePostSchema,
  },
);

export const deletePostAction = enhanceAction(
  async ({ postId }) => {
    const logger = await getLogger();
    const client = getSupabaseServerActionClient<Database>();

    logger.info(
      {
        postId,
      },
      `Deleting post...`,
    );

    const { error } = await client.from('posts').delete().eq('id', postId);

    if (error) {
      throw new Error(error.message);
    }

    logger.info(
      {
        postId,
      },
      `Post successfully deleted`,
    );

    revalidatePath(`/home`, 'layout');

    return {
      success: true,
    };
  },
  {
    schema: z.object({
      postId: z.string().uuid(),
    }),
  },
);
