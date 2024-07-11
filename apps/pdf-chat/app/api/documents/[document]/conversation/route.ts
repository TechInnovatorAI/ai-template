import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { NextRequest } from 'next/server';

import { SupabaseClient } from '@supabase/supabase-js';

import { StreamingTextResponse } from 'ai';
import { z } from 'zod';

import { getLogger } from '@kit/shared/logger';
import { requireUser } from '@kit/supabase/require-user';
import { getSupabaseRouteHandlerClient } from '@kit/supabase/route-handler-client';

import { createConversationTitle } from '~/lib/ai/create-conversation-title';
import { runConversationChain } from '~/lib/ai/run-conversation-chain';
import { Database } from '~/lib/database.types';

export const runtime = 'edge';

interface Params {
  document: string;
}

export async function POST(
  request: NextRequest,
  {
    params,
  }: {
    params: Params;
  },
) {
  const logger = await getLogger();
  const { messages, create } = getBodySchema().parse(await request.json());
  const conversationId = headers().get('x-conversation-id');

  if (!conversationId) {
    return new Response(`Missing conversation ID`, {
      status: 401,
    });
  }

  const client = getSupabaseRouteHandlerClient<Database>();
  const auth = await requireUser(client);

  if (!auth.data) {
    return redirect(auth.redirectTo);
  }

  let conversation: {
    id: number;
    account_id: string;
  };

  const { data: remainingTokens } = await client.rpc('get_remaining_tokens');

  // set a minimum number of tokens left to respond to a message
  // so we can safely assume that the user won't run out of tokens mid-conversation
  const minimumTokensRequired = 500;

  if (!remainingTokens || remainingTokens < minimumTokensRequired) {
    return new Response(`Cannot respond to message`, {
      status: 402,
    });
  }

  // if the client wants to create a new conversation, we create it
  if (create) {
    try {
      const input = messages[messages.length - 1]?.content ?? '';

      conversation = await createConversation({
        input,
        documentId: params.document,
        accountId: auth.data.id,
        client,
        conversationId,
      });
    } catch (error) {
      logger.error({ error }, `Error creating conversation`);

      return new Response(`Error creating conversation`, {
        status: 500,
      });
    }
  } else {
    const { error, data } = await client
      .from('conversations')
      .select('id, account_id')
      .eq('reference_id', conversationId)
      .single();

    if (error) {
      logger.error(`Error fetching conversation`, error);

      return new Response(`Error fetching conversation`, {
        status: 500,
      });
    }

    conversation = data;
  }

  const adminClient = getSupabaseRouteHandlerClient<Database>({
    admin: true,
  });

  const stream = await runConversationChain({
    client,
    adminClient: adminClient,
    conversationId: conversation.id,
    accountId: conversation.account_id,
    documentId: params.document,
    chatHistory: messages,
  });

  // if the AI can generate a response, we return a streaming response
  logger.info(
    {
      conversationId,
    },
    `Stream generated. Sending response...`,
  );

  return new StreamingTextResponse(stream);
}

function getBodySchema() {
  return z.object({
    create: z.boolean(),
    messages: z.array(
      z.object({
        content: z.string(),
        role: z.enum(['user', 'assistant'] as const),
      }),
    ),
  });
}

async function createConversation(params: {
  input: string;
  documentId: string;
  accountId: string;
  client: SupabaseClient<Database>;
  conversationId: string;
}) {
  const logger = await getLogger();
  const { input, documentId, accountId, client } = params;
  const title = await createConversationTitle(input);

  logger.info(
    {
      title,
      accountId,
    },
    `Conversation title successfully generated`,
  );

  logger.info(
    {
      accountId,
      documentId,
      title,
    },
    `Inserting conversation into database...`,
  );

  const { error, data } = await client
    .from('conversations')
    .insert({
      name: title,
      document_id: params.documentId,
      account_id: accountId,
      reference_id: params.conversationId,
    })
    .select('id, account_id')
    .single();

  if (error) {
    throw error;
  }

  logger.info(
    {
      conversationId: data.id,
    },
    `Conversation successfully inserted into database`,
  );

  return data;
}
