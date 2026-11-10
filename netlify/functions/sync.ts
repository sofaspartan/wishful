import { syncAllBrickfolio } from '../../server/integrations/brickfolio';
import { syncAllPlayshelf } from '../../server/integrations/playshelf';

/** Scheduled function: refresh connected sites (Brickfolio sheets, Playshelf libraries) every hour. */
export default async () => {
  const result = { brickfolio: await syncAllBrickfolio(), playshelf: await syncAllPlayshelf() };
  console.info('[sync]', result);
  return new Response(JSON.stringify(result), { headers: { 'content-type': 'application/json' } });
};

export const config = {
  schedule: '@hourly',
};
