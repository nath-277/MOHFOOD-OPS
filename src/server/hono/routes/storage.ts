import { Hono } from "hono";
import { getFromR2 } from "../../storage/r2";

export const storageRouter = new Hono();

/**
 * High-performance streaming proxy for Cloudflare R2 objects.
 * Serves media, product images, and documents without exposing R2 secrets or requiring third-party DNS setup.
 */
storageRouter.get("/:key{.+}", async (c) => {
  const key = c.req.param("key");
  if (!key) {
    return c.text("Key parameter missing", 400);
  }

  try {
    const object = await getFromR2(key);
    if (!object || !object.Body) {
      return c.text("Object not found in storage", 404);
    }

    const ifNoneMatch = c.req.header("if-none-match");
    if (ifNoneMatch && object.ETag && ifNoneMatch === object.ETag) {
      return new Response(null, { status: 304 });
    }

    const bytes = await object.Body.transformToByteArray();

    c.header("Content-Type", object.ContentType || "application/octet-stream");
    c.header("Content-Length", String(object.ContentLength || bytes.byteLength));
    c.header("Cache-Control", "public, max-age=31536000, immutable");
    if (object.ETag) c.header("ETag", object.ETag);
    if (object.LastModified) c.header("Last-Modified", object.LastModified.toUTCString());

    return c.body(bytes.buffer as ArrayBuffer);
  } catch (err: any) {
    console.error(`Error streaming R2 object [${key}]:`, err);
    return c.text("Internal Server Error retrieving file", 500);
  }
});
