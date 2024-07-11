import { SupabaseClient } from '@supabase/supabase-js';

import { getLogger } from '@kit/shared/logger';

import { Database } from '~/lib/database.types';

type Data = Array<{
  sections: Array<{
    value: string;
    bulletPoints: Array<{
      value: string;
    }>;
  }>;
}>;

/**
 * Estimates the number of tokens per section.
 */
const ESTIMATE_TOKENS_PER_SECTION = 750;

export function createTokenUsageTrackerService(
  adminClient: SupabaseClient<Database>,
  accountId: string,
) {
  return new TokenUsageTrackerService(adminClient, accountId);
}

class TokenUsageTrackerService {
  constructor(
    private readonly adminClient: SupabaseClient<Database>,
    private readonly accountId: string,
  ) {}

  estimateTokensCountFromData(data: Data) {
    return estimateTokensCount(data);
  }

  async consumeTokens(estimatedTokensUsage: number) {
    const logger = await getLogger();

    logger.info(
      {
        accountId: this.accountId,
        estimatedTokensUsage,
      },
      `Subtracting estimated tokens from organization...`,
    );

    // subtract the estimated tokens usage from the organization's tokens count
    return this.adminClient.rpc('consume_tokens', {
      tokens: estimatedTokensUsage,
      target_account_id: this.accountId,
    });
  }

  async updateOrganizationTokens(params: {
    tokensUsed: number;
    remainingTokens: number;
    estimatedTokensUsage: number;
  }) {
    const logger = await getLogger();

    const actualTokensCountDifference =
      params.estimatedTokensUsage - params.tokensUsed;

    const newTokensCount = params.remainingTokens + actualTokensCountDifference;

    logger.info(
      {
        accountId: this.accountId,
        newTokensCount,
      },
      `Updating organization tokens count...`,
    );

    return this.setAccountTokens(newTokensCount);
  }

  async rollbackTokensCount(
    remainingTokens: number,
    estimatedTokensUsage: number,
  ) {
    const logger = await getLogger();
    const tokens = remainingTokens + estimatedTokensUsage;

    logger.info(
      {
        accountId: this.accountId,
        tokens,
      },
      `Rolling back tokens count...`,
    );

    return this.setAccountTokens(tokens);
  }

  private async setAccountTokens(tokens: number) {
    const { error } = await this.adminClient
      .from('credits_usage')
      .update({
        tokens_quota: tokens,
      })
      .match({
        account_id: this.accountId,
      });

    if (error) {
      throw error;
    }
  }
}

/**
 * Estimates the total number of tokens based on the given data.
 */
export function estimateTokensCount(
  data: Array<{
    sections: Array<{
      value: string;
      bulletPoints: Array<{
        value: string;
      }>;
    }>;
  }>,
) {
  return data.reduce((acc, section) => {
    const sectionTokens = section.sections.length;

    return acc + sectionTokens * ESTIMATE_TOKENS_PER_SECTION;
  }, 0);
}
