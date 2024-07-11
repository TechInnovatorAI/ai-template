import { z } from 'zod';

export const DesignChatbotSchema = z.object({
  title: z.string(),
  textColor: z.string(),
  primaryColor: z.string(),
  accentColor: z.string(),
  position: z.enum([`bottom-left`, `bottom-right`]),
  chatbotId: z.string().uuid(),
});
