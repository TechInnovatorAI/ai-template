import { NextResponse } from 'next/server';

import { getSupabaseRouteHandlerClient } from '@kit/supabase/route-handler-client';
import { createTeamAccountsApi } from '@kit/team-accounts/api';

export async function GET(
  _: Request,
  params: {
    account: string;
  },
) {
  const client = getSupabaseRouteHandlerClient();
  const teamAccountApi = createTeamAccountsApi(client);

  const members = await teamAccountApi.getMembers(params.account);

  return NextResponse.json(members);
}
