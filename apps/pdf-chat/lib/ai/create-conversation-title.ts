import { OpenAI } from 'openai';

const LLM_MODEL_NAME = process.env.LLM_MODEL_NAME ?? 'gpt-turbo-3.5';
const LLM_BASE_URL = process.env.LLM_BASE_URL;
const LLM_API_KEY = process.env.LLM_API_KEY;

const FALLBACK_TITLE = `Conversation with AI assistant`;

export async function createConversationTitle(question: string) {
  const client = new OpenAI({
    baseURL: LLM_BASE_URL,
    apiKey: LLM_API_KEY,
  });

  const content = getPrompt(question);

  try {
    const response = await client.chat.completions.create({
      model: LLM_MODEL_NAME,
      max_tokens: 100,
      messages: [
        {
          role: `user`,
          content,
        },
      ],
    });

    const choice = response.choices[0];

    const title = choice?.message.content?.trim() ?? '';

    if (!title) {
      return FALLBACK_TITLE;
    }

    return cleanTitle(title);
  } catch (error) {
    console.error(
      `Failed to generate title using AI: ${JSON.stringify(error)}`,
    );

    return FALLBACK_TITLE;
  }
}

function getPrompt(question: string) {
  return `The user has started a chat conversation with the AI assistant. The user says: ${question}.
  
  Write an appropriate short title for labeling this conversation. The title should be no more than 3 or 4 words long.
  
  If the context is not clear, use a generic title like ${FALLBACK_TITLE}".
  
  Rules:
  - Do not wrap the title with double quotes!
  - Only write the title, do not write anything else!
  `;
}

function cleanTitle(title: string) {
  return title.replace(/^"/, ``).replace(/"$/, ``);
}
