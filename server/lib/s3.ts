import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import * as fs from "fs";
import { logger } from "./logger";

const endpoint = process.env.PLATFORM_S3_ENDPOINT || process.env.S3_ENDPOINT;
const bucket = process.env.PLATFORM_S3_BUCKET || process.env.S3_BUCKET || "maternal-mind";
const accessKeyId = process.env.PLATFORM_S3_ACCESS_KEY || process.env.S3_ACCESS_KEY || "maternal-mind";
const secretAccessKey = process.env.PLATFORM_S3_SECRET_KEY || process.env.S3_SECRET_KEY;

export const s3Enabled = Boolean(endpoint && secretAccessKey);

export const s3Client = s3Enabled
  ? new S3Client({
      endpoint,
      region: "us-east-1",
      credentials: {
        accessKeyId: accessKeyId!,
        secretAccessKey: secretAccessKey!,
      },
      forcePathStyle: true,
    })
  : null;

export async function uploadToMinIO(
  key: string,
  filePath: string,
  contentType: string,
): Promise<boolean> {
  if (!s3Client) {
    logger.warn(`[MinIO] S3 client not configured — skipping upload for ${key}`);
    return false;
  }
  try {
    const fileBuffer = fs.readFileSync(filePath);
    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: fileBuffer,
      ContentType: contentType,
    });
    await s3Client.send(command);
    logger.info(`[MinIO] Successfully uploaded ${key} to bucket ${bucket}`);
    return true;
  } catch (err) {
    logger.error(`[MinIO] Failed to upload ${key} to bucket ${bucket}`, { error: String(err) });
    return false;
  }
}

export async function getObjectFromMinIO(
  key: string,
): Promise<{ body: any; contentType?: string } | null> {
  if (!s3Client) return null;
  try {
    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: key,
    });
    const response = await s3Client.send(command);
    return {
      body: response.Body,
      contentType: response.ContentType,
    };
  } catch {
    return null;
  }
}
