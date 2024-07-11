import { redirect } from 'next/navigation';
import { NextRequest } from 'next/server';

// This route is called when the user visits /home/[account]/chatbots/[chatbot]
// We redirect to /home/[account]/chatbots/[chatbot]/[document]
export function GET(req: NextRequest) {
  return redirect(req.nextUrl.pathname + '/documents');
}
