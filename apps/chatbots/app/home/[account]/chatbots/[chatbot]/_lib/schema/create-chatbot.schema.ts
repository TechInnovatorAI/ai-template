import { z } from 'zod';

export const CreateChatbotFormSchema = z.object({
  name: z.string().min(2),
  description: z.string().optional(),
  url: z.string().url(),
  siteName: z.string(),
  accountId: z.string(),
});
