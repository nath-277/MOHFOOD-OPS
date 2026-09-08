import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

const accountId = process.env.CLOUDFLARE_R2_ACCOUNT_ID;
const accessKeyId = process.env.CLOUDFLARE_R2_ACCESS_KEY_ID;
const secretAccessKey = process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY;
const bucketName = process.env.CLOUDFLARE_R2_BUCKET_NAME || "moh-ops";
const publicDomain = process.env.CLOUDFLARE_R2_PUBLIC_DOMAIN;
const endpoint = process.env.CLOUDFLARE_R2_ENDPOINT || (accountId ? `https://${accountId}.r2.cloudflarestorage.com` : undefined);

let s3Client: S3Client | null = null;

export function getR2Client(): S3Client | null {
  if (s3Client) return s3Client;

  if (!accessKeyId || !secretAccessKey || !endpoint) {
    console.warn("⚠️ Cloudflare R2 credentials are not fully configured in environment.");
    return null;
  }

  try {
    s3Client = new S3Client({
      region: "auto",
      endpoint,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });
    return s3Client;
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
  const client = getR2Client();
  if (!client) {
    throw new Error("Cloudflare R2 storage client is not configured.");
  }

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
