import { syncAllBrickfolio } from '../../server/integrations/brickfolio';

/** Scheduled function: refresh connected sites (Brickfolio sheets) every hour. */
export default async () => {
  const result = await syncAllBrickfolio();
  console.info('[sync]', result);
  return new Response(JSON.stringify(result), { headers: { 'content-type': 'application/json' } });
};

export const config = {
  schedule: '@hourly',
};
