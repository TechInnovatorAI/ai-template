import { OpenAIEmbeddings } from '@langchain/openai';
import { z } from 'zod';

export function getEmbeddingsModel() {
  return getOpenAIEmbeddingsModel();
}

/**
 * Get the embeddings model to use for the AI using OpenAI.
 * Good for production.
 */
function getOpenAIEmbeddingsModel() {
  const data = z
    .object({
      openAIApiKey: z.string().min(1),
      baseURL: z.string().min(1).optional(),
    })
    .parse({
      openAIApiKey: process.env.LLM_API_KEY,
      baseURL: process.env.LLM_BASE_URL,
    });

  return new OpenAIEmbeddings({
    openAIApiKey: data.openAIApiKey,
    configuration: {
      baseURL: data.baseURL,
    },
  });
}
