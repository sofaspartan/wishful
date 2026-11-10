import { listImportRequestSchema, metadataRequestSchema, notificationsReadSchema } from '../../shared/schemas';
import { LIMITS } from '../../shared/constants';
import { images, getDriver } from '../storage';
import { HttpError, badRequest, json, notFound, readJson, type Router } from '../http';
import { requireUser, updateUserIndex } from '../services/auth';
import { rateLimit } from '../services/rateLimit';
import { fetchUrlMetadata } from '../services/metadata';
import { importList } from '../services/listImport';
import { UnsafeUrlError } from '../services/safeFetch';
import { listNotifications, markRead } from '../services/notifications';
import { emailConfigured } from '../services/email';
import { newId, nowIso } from '../util';

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] as const;

/** Identify an image by its magic bytes — never trust the declared Content-Type. SVG is rejected (XSS risk). */
export function sniffImageType(buf: Uint8Array): (typeof IMAGE_TYPES)[number] | null {
  if (buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return 'image/png';
  if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x38) return 'image/gif';
  const riff = String.fromCharCode(...buf.slice(0, 4));
  const webp = String.fromCharCode(...buf.slice(8, 12));
  if (riff === 'RIFF' && webp === 'WEBP') return 'image/webp';
  return null;
}

export function registerMiscRoutes(router: Router) {
  router.get('/api/health', async () =>
    json({ ok: true, storage: getDriver().name, email: emailConfigured() ? 'configured' : 'not_configured' }),
  );

  router.post('/api/images', async (ctx) => {
    const user = await requireUser(ctx);
    await rateLimit('upload', user.id);
    const declared = Number(ctx.req.headers.get('content-length') || 0);
    if (declared > LIMITS.imageBytes) throw new HttpError(413, 'Images must be 5 MB or smaller.', 'too_large');
    const buf = new Uint8Array(await ctx.req.arrayBuffer());
    if (buf.byteLength === 0) throw badRequest('No image was uploaded.');
    if (buf.byteLength > LIMITS.imageBytes) throw new HttpError(413, 'Images must be 5 MB or smaller.', 'too_large');
    const type = sniffImageType(buf);
    if (!type) throw badRequest('Please upload a JPEG, PNG, WebP or GIF image.');
    const id = newId(16);
    await images().set(id, buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer, {
      contentType: type,
      ownerId: user.id,
      createdAt: nowIso(),
    });
    await updateUserIndex(user.id, (idx) => {
      idx.imageIds.push(id);
    });
    return json({ url: `/api/images/${id}` }, 201);
  });

  router.get('/api/images/:id', async (ctx) => {
    if (!/^[A-Za-z0-9_-]{8,64}$/.test(ctx.params.id)) throw notFound();
    const obj = await images().get(ctx.params.id);
    if (!obj) throw notFound('Image not found.');
    const type = IMAGE_TYPES.find((t) => t === obj.metadata.contentType) ?? 'application/octet-stream';
    return new Response(obj.data, {
      status: 200,
      headers: {
        'content-type': type,
        'cache-control': 'public, max-age=31536000, immutable',
        'x-content-type-options': 'nosniff',
        'content-security-policy': "default-src 'none'; sandbox",
      },
    });
  });

  router.post('/api/metadata', async (ctx) => {
    const user = await requireUser(ctx);
    await rateLimit('metadata', user.id);
    const { url } = await readJson(ctx.req, metadataRequestSchema);
    try {
      return json(await fetchUrlMetadata(url));
    } catch (err) {
      if (err instanceof UnsafeUrlError) throw badRequest(err.message, { url: err.message });
      throw err;
    }
  });

  router.post('/api/import/list', async (ctx) => {
    const user = await requireUser(ctx);
    await rateLimit('listImport', user.id);
    const { url, next } = await readJson(ctx.req, listImportRequestSchema);
    try {
      return json(await importList(url, next));
    } catch (err) {
      if (err instanceof UnsafeUrlError) throw badRequest(err.message, { url: err.message });
      throw err;
    }
  });

  router.get('/api/notifications', async (ctx) => {
    const user = await requireUser(ctx);
    return json({ notifications: await listNotifications(user.id) });
  });

  router.post('/api/notifications/read', async (ctx) => {
    const user = await requireUser(ctx);
    const input = await readJson(ctx.req, notificationsReadSchema);
    const notifications = await markRead(user.id, input.all ? 'all' : (input.ids ?? []));
    return json({ notifications });
  });
}
