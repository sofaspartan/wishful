import { giftSearchSchema, zodFieldErrors } from '../../shared/schemas';
import { badRequest, json, type Router } from '../http';
import { getCurrentUser } from '../services/auth';
import { rateLimit } from '../services/rateLimit';
import { searchGifts } from '../services/giftSearch';

export function registerGiftRoutes(router: Router) {
  // Open to visitors too: results are public store listings, and adding one to a list still needs an account.
  router.get('/api/gifts/search', async (ctx) => {
    const user = await getCurrentUser(ctx);
    const parsed = giftSearchSchema.safeParse(Object.fromEntries(ctx.url.searchParams));
    if (!parsed.success) {
      const fields = zodFieldErrors(parsed.error);
      throw badRequest(Object.values(fields)[0] ?? 'Please check your search.', fields);
    }
    if (user) await rateLimit('giftSearch', user.id);
    else await rateLimit('giftSearchGuest', ctx.ip);
    return json(await searchGifts(parsed.data));
  });
}
