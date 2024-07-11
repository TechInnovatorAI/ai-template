import { z } from 'zod';

export const UpdateChatbotSchema = z.object({
  name: z.string(),
  description: z.string().nullish(),
  url: z.string().url(),
  site_name: z.string().min(1),
  id: z.string().uuid(),
});
