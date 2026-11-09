import { runDailyJobs } from '../../server/jobs';

/** Scheduled function: occasion reminders + storage cleanup, once a day. */
export default async () => {
  const result = await runDailyJobs();
  console.info('[daily]', result);
  return new Response(JSON.stringify(result), { headers: { 'content-type': 'application/json' } });
};

export const config = {
  schedule: '@daily',
};
