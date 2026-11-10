import { giftSearchSchema, zodFieldErrors } from '../../shared/schemas';
import { badRequest, json, type Router } from '../http';
import { requireUser } from '../services/auth';
import { rateLimit } from '../services/rateLimit';
import { searchGifts } from '../services/giftSearch';

export function registerGiftRoutes(router: Router) {
  router.get('/api/gifts/search', async (ctx) => {
    const user = await requireUser(ctx);
    const parsed = giftSearchSchema.safeParse(Object.fromEntries(ctx.url.searchParams));
    if (!parsed.success) {
      const fields = zodFieldErrors(parsed.error);
      throw badRequest(Object.values(fields)[0] ?? 'Please check your search.', fields);
    }
    await rateLimit('giftSearch', user.id);
    return json(await searchGifts(parsed.data));
  });
}
