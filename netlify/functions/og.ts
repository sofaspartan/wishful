import { handleOgRequest } from '../../server/og';

/** Link-preview images (see server/og). Kept apart from the API so its cold starts stay small. */
export default async (req: Request) => handleOgRequest(req);

export const config = {
  path: '/og/*',
};
