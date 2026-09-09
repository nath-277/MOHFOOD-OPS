import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

function cleanEnv(val?: string): string {
  if (!val) return "";
  return val.trim().replace(/^["']|["']$/g, "").trim();
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
 */
export async function uploadToR2({
  buffer,
  fileName,
  contentType,
  folder = "uploads",
}: {
  buffer: Buffer | Uint8Array;
  fileName: string;
  contentType: string;
  folder?: string;
}): Promise<UploadResult> {
  const r2 = getR2Client();
  if (!r2) {
    const cfg = getR2Config();
    throw new Error(
      `Cloudflare R2 storage is not configured properly (key length: ${cfg.accessKeyId?.length || 0}, endpoint: ${cfg.endpoint ? "set" : "missing"}).`
    );
  }

  const { client, bucketName, publicDomain, endpoint } = r2;

  // Clean filename and generate unique key
  const sanitizedName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_").toLowerCase();
  const timestamp = Date.now();
  const randomSuffix = Math.random().toString(36).substring(2, 8);
  const key = `${folder}/${timestamp}-${randomSuffix}-${sanitizedName}`;

  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: key,
    Body: buffer,
    ContentType: contentType,
  });

  await client.send(command);

  // Construct public URL
  let url = "";
  if (publicDomain) {
    const firstDomain = publicDomain.split(",")[0].trim().replace(/\/+$/, "");
    const formattedDomain = firstDomain.startsWith("http") ? firstDomain : `https://${firstDomain}`;
    url = `${formattedDomain}/${key}`;
  } else {
    url = `${endpoint}/${bucketName}/${key}`;
  }

  return {
    url,
    key,
    bucket: bucketName,
    size: buffer.length,
    contentType,
  };
}
