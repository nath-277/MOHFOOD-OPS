import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";

function cleanEnv(val?: string): string {
  if (!val) return "";
  return val.trim().replace(/^["']|["']$/g, "").trim();
}

export function sanitizeSlug(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function getR2Config() {
  const accountId = cleanEnv(process.env.CLOUDFLARE_R2_ACCOUNT_ID);
  const accessKeyId = cleanEnv(process.env.CLOUDFLARE_R2_ACCESS_KEY_ID);
  const secretAccessKey = cleanEnv(process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY);
  const bucketName = cleanEnv(process.env.CLOUDFLARE_R2_BUCKET_NAME) || "mohfood";
  const publicDomain = cleanEnv(process.env.CLOUDFLARE_R2_PUBLIC_DOMAIN);
  const endpoint =
    cleanEnv(process.env.CLOUDFLARE_R2_ENDPOINT) ||
    (accountId ? `https://${accountId}.r2.cloudflarestorage.com` : "");

  return {
    accountId,
    accessKeyId,
    secretAccessKey,
    bucketName,
    publicDomain,
    endpoint,
  };
}

let cachedClient: S3Client | null = null;
let lastKeyId = "";

export function getR2Client(): { client: S3Client; bucketName: string; publicDomain: string; endpoint: string } | null {
  const config = getR2Config();

  if (!config.accessKeyId || !config.secretAccessKey || !config.endpoint) {
    console.warn("⚠️ Cloudflare R2 credentials are not fully configured in environment.");
    return null;
  }

  if (cachedClient && lastKeyId === config.accessKeyId) {
    return {
      client: cachedClient,
      bucketName: config.bucketName,
      publicDomain: config.publicDomain,
      endpoint: config.endpoint,
    };
  }

  try {
    cachedClient = new S3Client({
      region: "auto",
      endpoint: config.endpoint,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    });
    lastKeyId = config.accessKeyId;
    return {
      client: cachedClient,
      bucketName: config.bucketName,
      publicDomain: config.publicDomain,
      endpoint: config.endpoint,
    };
  } catch (err) {
    console.error("Failed to initialize Cloudflare R2 client:", err);
    return null;
  }
}

export interface UploadResult {
  url: string;
  key: string;
  bucket: string;
  size: number;
  contentType: string;
}

/**
 * Uploads a file buffer to Cloudflare R2 object storage.
 * The file is named cleanly after the product rather than using random strings.
 */
export async function uploadToR2({
  buffer,
  fileName,
  contentType,
  folder = "uploads",
  productName,
  itemCode,
}: {
  buffer: Buffer | Uint8Array;
  fileName: string;
  contentType: string;
  folder?: string;
  productName?: string;
  itemCode?: string;
}): Promise<UploadResult> {
  const r2 = getR2Client();
  if (!r2) {
    const cfg = getR2Config();
    throw new Error(
      `Cloudflare R2 storage is not configured properly (key length: ${cfg.accessKeyId?.length || 0}, endpoint: ${cfg.endpoint ? "set" : "missing"}).`
    );
  }

  const { client, bucketName, publicDomain } = r2;

  // Extract file extension
  const extMatch = fileName.match(/\.([a-zA-Z0-9]+)$/);
  const ext = extMatch
    ? extMatch[1].toLowerCase()
    : (contentType.split("/")[1] || "jpg").toLowerCase().replace("jpeg", "jpg");

  // Format file name after product name or SKU without random hashes
  let cleanName = "";
  if (productName && productName.trim()) {
    cleanName = `${sanitizeSlug(productName)}.${ext}`;
  } else if (itemCode && itemCode.trim()) {
    cleanName = `${sanitizeSlug(itemCode)}.${ext}`;
  } else {
    const baseWithoutExt = fileName.replace(/\.[^/.]+$/, "");
    const slug = sanitizeSlug(baseWithoutExt) || "document";
    cleanName = `${slug}.${ext}`;
  }

  const key = `${folder}/${cleanName}`;

  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: key,
    Body: buffer,
    ContentType: contentType,
  });

  await client.send(command);

  // Construct URL
  // If publicDomain contains a dedicated Cloudflare R2 CDN or pub domain (e.g. pub-xxx.r2.dev or cdn.xxx)
  let url = "";
  if (
    publicDomain &&
    (publicDomain.includes(".r2.dev") ||
      publicDomain.includes("cdn.") ||
      publicDomain.includes("r2."))
  ) {
    const firstDomain = publicDomain.split(",")[0].trim().replace(/\/+$/, "");
    const formattedDomain = firstDomain.startsWith("http") ? firstDomain : `https://${firstDomain}`;
    url = `${formattedDomain}/${key}`;
  } else {
    // Default to internal storage proxy route so it fetches seamlessly across all environments
    url = `/api/storage/${key}`;
  }

  return {
    url,
    key,
    bucket: bucketName,
    size: buffer.length,
    contentType,
  };
}

/**
 * Retrieves an object from Cloudflare R2 object storage.
 */
export async function getFromR2(key: string) {
  const r2 = getR2Client();
  if (!r2) return null;

  try {
    const command = new GetObjectCommand({
      Bucket: r2.bucketName,
      Key: key,
    });
    return await r2.client.send(command);
  } catch (err: any) {
    if (err.name === "NoSuchKey" || err.$metadata?.httpStatusCode === 404) {
      return null;
    }
    throw err;
  }
}

