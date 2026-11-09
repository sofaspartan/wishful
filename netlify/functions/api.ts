import { handleRequest } from '../../server/app';

/** All `/api/*` traffic is served by this single function (see server/app.ts). */
export default async (req: Request, context: { ip?: string }) => handleRequest(req, { ip: context?.ip });

export const config = {
  path: '/api/*',
};
