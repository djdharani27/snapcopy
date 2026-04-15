import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

function assertAwsEnv() {
  const required = {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    region: process.env.AWS_REGION,
    bucketName: process.env.AWS_S3_BUCKET_NAME,
  };

  const missing = Object.entries(required)
    .filter(([, value]) => !value)
    .map(([key]) => key);

  if (missing.length > 0) {
    throw new Error(
      `Missing AWS env vars: ${missing.join(", ")}. Add them to .env.local.`,
    );
  }
}

export function getBucketName() {
  assertAwsEnv();
  return process.env.AWS_S3_BUCKET_NAME as string;
}

function getS3Endpoint() {
  const explicitEndpoint = process.env.AWS_S3_ENDPOINT;
  if (explicitEndpoint) return explicitEndpoint;

  const region = process.env.AWS_REGION as string;
  return `https://s3.${region}.amazonaws.com`;
}

function getS3Client() {
  assertAwsEnv();

  return new S3Client({
    region: process.env.AWS_REGION,
    endpoint: getS3Endpoint(),
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID as string,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY as string,
    },
  });
}

export async function uploadBufferToS3(params: {
  key: string;
  buffer: Buffer;
  contentType: string;
}) {
  const client = getS3Client();

  await client.send(
    new PutObjectCommand({
      Bucket: getBucketName(),
      Key: params.key,
      Body: params.buffer,
      ContentType: params.contentType,
    }),
  );

  return {
    key: params.key,
    url: `s3://${getBucketName()}/${params.key}`,
  };
}

export async function getDownloadUrl(key: string) {
  const client = getS3Client();

  return getSignedUrl(
    client,
    new GetObjectCommand({
      Bucket: getBucketName(),
      Key: key,
    }),
    { expiresIn: 60 * 10 },
  );
}
