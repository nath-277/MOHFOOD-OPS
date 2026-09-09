import { Hono } from "hono";
import { R2_MANAGED_DOMAIN } from "../../storage/r2";

export const storageRouter = new Hono();

/**
 * Fast redirect & CDN bridge for Cloudflare R2 objects.
 * Redirects seamlessly to Cloudflare's public CDN edge domain (pub-xxx.r2.dev).
 */
storageRouter.get("/:key{.+}", (c) => {
  const key = c.req.param("key");
  if (!key) {
    return c.text("Key parameter missing", 400);
  }

  const edgeUrl = `${R2_MANAGED_DOMAIN}/${key}`;
  return c.redirect(edgeUrl, 302);
});
