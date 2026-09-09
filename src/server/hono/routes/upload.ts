import { Hono } from "hono";
import { getCookie } from "hono/cookie";
import { AUTH_COOKIE_NAME, verifySession } from "../../auth/session";
import { uploadToR2 } from "../../storage/r2";

export const uploadRouter = new Hono();

uploadRouter.post("/", async (c) => {
  try {
    const token = getCookie(c, AUTH_COOKIE_NAME);
    if (!token) {
      return c.json({ error: "Unauthorized. Please log in to upload documents." }, 401);
    }
    const session = await verifySession(token);
    if (!session) {
      return c.json({ error: "Session expired. Please log in again." }, 401);
    }

    const body = await c.req.parseBody();
    const file = body["file"];
    const folder = (body["folder"] as string) || "documents";

    if (!file || !(file instanceof File)) {
      return c.json({ error: "No valid file uploaded." }, 400);
    }

    // Size check (max 15MB)
    if (file.size > 15 * 1024 * 1024) {
      return c.json({ error: "File exceeds 15MB size limit." }, 400);
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const uploadResult = await uploadToR2({
      buffer,
      fileName: file.name,
      contentType: file.type || "application/octet-stream",
      folder,
    });

    return c.json({
      success: true,
      url: uploadResult.url,
      fileUrl: uploadResult.url,
      key: uploadResult.key,
      size: uploadResult.size,
      contentType: uploadResult.contentType,
      uploadedBy: session.fullName,
    });
  } catch (err: any) {
    console.error("Cloudflare R2 file upload error:", err);
    return c.json({ error: err.message || "Failed to upload file to Cloudflare R2." }, 500);
  }
});
