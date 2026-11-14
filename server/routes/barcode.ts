import { z } from 'zod';
import { isValidBarcode, normalizeBarcode } from '../../shared/barcode';
import { zodFieldErrors } from '../../shared/schemas';
import { badRequest, json, type Router } from '../http';
import { requireUser } from '../services/auth';
import { lookupBarcode } from '../services/barcodeLookup';
import { rateLimit } from '../services/rateLimit';

const barcodeParamSchema = z.object({
  code: z
    .string()
    .trim()
    .min(1, 'Enter a barcode')
    .max(32, 'That barcode is too long')
    .refine((v) => isValidBarcode(v), 'Use an 8–14 digit UPC / EAN code'),
});

export function registerBarcodeRoutes(router: Router) {
  // Signed-in only: aisle scanning feeds into the add-item flow.
  router.get('/api/barcode/:code', async (ctx) => {
    const user = await requireUser(ctx);
    await rateLimit('barcodeLookup', user.id);

    const parsed = barcodeParamSchema.safeParse({ code: ctx.params.code });
    if (!parsed.success) {
      const fields = zodFieldErrors(parsed.error);
      throw badRequest(Object.values(fields)[0] ?? 'Invalid barcode.', fields);
    }

    const code = normalizeBarcode(parsed.data.code);
    return json(await lookupBarcode(code));
  });
}
