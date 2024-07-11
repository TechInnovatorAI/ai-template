import { SupabaseClient } from '@supabase/supabase-js';

import { BaseCallbackHandler } from '@langchain/core/callbacks/base';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { LLMResult } from '@langchain/core/outputs';
import { PromptTemplate } from '@langchain/core/prompts';
import { RunnableSequence } from '@langchain/core/runnables';
import { ConsoleCallbackHandler } from '@langchain/core/tracers/console';
import { ChatOpenAI } from '@langchain/openai';
import { encode } from 'gpt-tokenizer';
import { ContextualCompressionRetriever } from 'langchain/retrievers/contextual_compression';
import { DocumentCompressorPipeline } from 'langchain/retrievers/document_compressors';
import { EmbeddingsFilter } from 'langchain/retrievers/document_compressors/embeddings_filter';
import { formatDocumentsAsString } from 'langchain/util/document';

import { getLogger } from '@kit/shared/logger';

import { getEmbeddingsModel } from '~/lib/ai/embeddings-model';
import { getVectorStore } from '~/lib/ai/vector-store';
import { Database } from '~/lib/database.types';

const LLM_MODEL_NAME = process.env.LLM_MODEL_NAME ?? 'gpt-turbo-3.5';
const LLM_BASE_URL = process.env.LLM_BASE_URL;
const LLM_API_KEY = process.env.LLM_API_KEY;

const MAX_DOCUMENTS_CONTEXT = 3;

type ChatHistory = Array<{
  content: string;
  role: 'user' | 'assistant';
}>;

export async function runConversationChain(params: {
  client: SupabaseClient<Database>;
  adminClient: SupabaseClient<Database>;
  conversationId: number;
  accountId: string;
  documentId: string;
  chatHistory: ChatHistory;
}) {
  const { adminClient, chatHistory, documentId, client } = params;
  const question = chatHistory[chatHistory.length - 1]?.content ?? '';

  chatHistory.pop();

  const callbacks: Array<BaseCallbackHandler> = [
    new StreamEndCallbackHandler(
      client,
      adminClient,
      params.accountId,
      params.conversationId,
      question,
    ),
    new ConsoleCallbackHandler(),
  ];

  const model = createModel({
    streaming: true,
    temperature: 0,
    callbacks,
  });

  const retriever = await getVectorStoreRetriever(adminClient, documentId);

  const chain = RunnableSequence.from([
    {
      question: (input: { question: string; chatHistory?: ChatHistory }) =>
        input.question,
    },
    {
      question: (previousStepResult: {
        question: string;
        chatHistory?: ChatHistory;
      }) => previousStepResult.question,
      chatHistory: (previousStepResult: {
        question: string;
        chatHistory?: ChatHistory;
      }) => serializeChatHistory(previousStepResult.chatHistory ?? []),
      context: async (previousStepResult: {
        question: string;
        chatHistory?: string;
      }) => {
        const relevantDocs = await retriever.invoke(
          previousStepResult.question,
        );

        return formatDocumentsAsString(relevantDocs);
      },
    },
    getQuestionPrompt(),
    model,
    new StringOutputParser(),
  ]);

  return chain.stream({
    question,
    chatHistory,
  });
}

async function insertConversationMessages(params: {
  conversationId: number;
  accountId: string;
  client: SupabaseClient<Database>;
  adminClient: SupabaseClient<Database>;
  text: string;
  previousMessage: string;
}) {
  const table = params.client.from('messages');
  const logger = await getLogger();

  if (!params.conversationId) {
    logger.warn(
      {
        conversationReferenceId: params.conversationId,
      },
      `Conversation not found. Can't insert messages.`,
    );

    return {
      error: new Error(`Conversation not found. Can't insert messages.`),
    };
  }

  return table.insert([
    {
      conversation_id: params.conversationId,
      account_id: params.accountId,
      text: params.previousMessage,
      sender: 'user' as const,
    },
    {
      conversation_id: params.conversationId,
      account_id: params.accountId,
      text: params.text,
      sender: 'assistant' as const,
    },
  ]);
}

class StreamEndCallbackHandler extends BaseCallbackHandler {
  name = 'handle-stream-end';

  constructor(
    private readonly client: SupabaseClient<Database>,
    private readonly adminClient: SupabaseClient<Database>,
    private readonly accountId: string,
    private readonly conversationId: number,
    private readonly previousMessage: string,
  ) {
    super();
  }

  async handleLLMEnd(output: LLMResult) {
    const logger = await getLogger();

    logger.info(
      {
        conversationId: this.conversationId,
      },
      `[handleLLMEnd] Inserting messages...`,
    );

    const generations = output.generations;

    const text = generations.reduce((acc, generationsList) => {
      return (
        acc +
        generationsList.reduce((innerAcc, generation) => {
          return innerAcc + `\n` + generation.text;
        }, '')
      );
    }, '');

    // we need to calculate the tokens usage
    // langchain doesn't provide this information (at least not consistently)
    const queryTokens = encode(this.previousMessage).length;
    const replyTokens = encode(text).length;
    const totalTokens = queryTokens + replyTokens;

    return await Promise.allSettled([
      this.handleInsertMessages(text),
      this.handleTokensUsage(totalTokens),
    ]);
  }

  private async handleInsertMessages(text: string) {
    const logger = await getLogger();

    logger.info(
      {
        conversationId: this.conversationId,
      },
      `Inserting messages...`,
    );

    const response = await insertConversationMessages({
      client: this.client,
      adminClient: this.adminClient,
      accountId: this.accountId,
      conversationId: this.conversationId,
      previousMessage: this.previousMessage,
      text,
    });

    if (response.error) {
      logger.error(
        {
          conversationId: this.conversationId,
          error: response.error,
        },
        `Error inserting messages.`,
      );
    } else {
      logger.info(
        {
          conversationId: this.conversationId,
        },
        `Successfully inserted messages.`,
      );
    }
  }

  private async handleTokensUsage(totalTokens: number) {
    const logger = await getLogger();

    logger.info(
      {
        conversationId: this.conversationId,
      },
      `Reporting tokens usage...`,
    );

    // we need to calculate the tokens usage and report it
    const { data: remainingTokens } = await this.client.rpc(
      'get_remaining_tokens',
    );

    const tokens = (remainingTokens ?? 0) - totalTokens;

    logger.info(
      {
        remainingTokens,
        totalTokens,
        tokens,
        conversationId: this.conversationId,
      },
      `Setting tokens quota to ${tokens} tokens.`,
    );

    const response = await this.adminClient
      .from('credits_usage')
      .update({
        tokens_quota: tokens,
      })
      .match({
        account_id: this.accountId,
      });

    if (response.error) {
      console.error(response.error);

      logger.error(
        {
          conversationId: this.conversationId,
          error: response.error,
          tokens,
        },
        `Error reporting tokens usage.`,
      );
    } else {
      logger.info(
        {
          conversationId: this.conversationId,
          previousTokens: remainingTokens,
          tokens,
        },
        `Successfully reported tokens usage.`,
      );
    }
  }
}

async function getVectorStoreRetriever(
  client: SupabaseClient<Database>,
  documentId: string,
) {
  const similarityThreshold = 0.5;
  const maxDocuments = 5;

  const embeddingsFilter = new EmbeddingsFilter({
    embeddings: getEmbeddingsModel(),
    similarityThreshold: similarityThreshold,
    k: maxDocuments,
  });

  const compressorPipeline = new DocumentCompressorPipeline({
    transformers: [embeddingsFilter],
  });

  const vectorStore = await getVectorStore(client);

  const retriever = vectorStore.asRetriever(MAX_DOCUMENTS_CONTEXT, (filter) => {
    return filter.eq('metadata -> document_id::uuid', `"${documentId}"`);
  });

  return new ContextualCompressionRetriever({
    baseCompressor: compressorPipeline,
    baseRetriever: retriever,
  });
}

function getQuestionPrompt() {
  return PromptTemplate.fromTemplate(
    `Use the following pieces of context to answer the question at the end. If you don't know the answer, just say that you don't know, don't try to make up an answer.
      ----------------
      CHAT HISTORY: {chatHistory}
      ----------------
      CONTEXT: {context}
      ----------------
      QUESTION: {question}
      ----------------
      Helpful Answer:`,
  );
}

function serializeChatHistory(chatHistory: ChatHistory) {
  return (chatHistory ?? []).reduce((acc, message) => {
    return acc + `\n` + message.role + `:` + message.content + `\n`;
  }, '');
}

function createModel(props: {
  callbacks?: BaseCallbackHandler[];
  streaming?: boolean;
  temperature?: number;
}) {
  return new ChatOpenAI({
    modelName: LLM_MODEL_NAME,
    temperature: props.temperature ?? 0,
    streaming: props.streaming ?? true,
    maxTokens: 200,
    openAIApiKey: LLM_API_KEY,
    configuration: {
      baseURL: LLM_BASE_URL,
    },
    callbacks: props.callbacks ?? [],
  });
}
