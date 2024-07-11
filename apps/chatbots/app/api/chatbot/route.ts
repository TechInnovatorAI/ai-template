import { NextRequest, NextResponse } from 'next/server';

import { isbot } from 'isbot';
import { nanoid } from 'nanoid';

import { getSupabaseRouteHandlerClient } from '@kit/supabase/route-handler-client';

import { createChatbotsService } from '~/home/[account]/chatbots/_lib/server/chatbots-service';

const CONVERSATION_ID_STORAGE_KEY = getConversationIdHeaderName();

const HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET',
  'Access-Control-Allow-Headers':
    'Content-Type, x-chatbot-id, x-conversation-id, User-Agent',
};

export function OPTIONS() {
  return new Response(null, {
    status: 200,
    headers: HEADERS,
  });
}

export async function GET(req: NextRequest) {
  const userAgent = req.headers.get('user-agent');

  if (isbot(userAgent)) {
    return new Response(`No chatbot for you!`, {
      status: 403,
    });
  }

  const chatbotId = req.nextUrl.searchParams.get('id');
  let conversationId = req.headers.get(CONVERSATION_ID_STORAGE_KEY);

  if (!chatbotId) {
    return new Response('Missing chatbot ID', { status: 400 });
  }

  const client = getSupabaseRouteHandlerClient({
    admin: true,
  });

  const service = createChatbotsService(client);
  const { settings, siteName } = await service.getChatbotSettings(chatbotId);

  // if there is no conversation ID, we generate one and store it in a cookie
  // so that we can keep track of the conversation
  if (!conversationId) {
    conversationId = nanoid(16);
  }

  const payload = {
    settings,
    siteName,
    conversationId,
  };

  return NextResponse.json(payload, {
    headers: HEADERS,
  });
}

function getConversationIdHeaderName() {
  return process.env.CONVERSATION_ID_STORAGE_KEY ?? `x-conversation-id`;
}
