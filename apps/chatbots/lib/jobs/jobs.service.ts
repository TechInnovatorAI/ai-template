import { SupabaseClient } from '@supabase/supabase-js';

import { Database } from '~/lib/database.types';

export function createJobsService(client: SupabaseClient<Database>) {
  return new JobsService(client);
}

class JobsService {
  constructor(private readonly client: SupabaseClient<Database>) {}

  async getJobById(jobId: number) {
    return this.client.from('jobs').select('*').eq('id', jobId).single();
  }

  async updateJob(
    jobId: number,
    params: Database['public']['Tables']['jobs']['Update'],
  ) {
    return this.client.from('jobs').update(params).match({ id: jobId });
  }

  insertJob(params: Database['public']['Tables']['jobs']['Insert']) {
    return this.client.from('jobs').insert(params);
  }
}
