const { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');

const accountId = process.env.R2_ACCOUNT_ID;
const accessKeyId = process.env.R2_ACCESS_KEY_ID;
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
const bucketName = process.env.R2_BUCKET_NAME;

let s3Client = null;

if (accountId && accessKeyId && secretAccessKey) {
  s3Client = new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId,
      secretAccessKey
    }
  });
}

/**
 * Uploads a file buffer to Cloudflare R2.
 * Returns the key (file ID).
 */
async function uploadFile(fileName, buffer, mimeType = 'application/pdf') {
  if (!s3Client) {
    throw new Error('Cloudflare R2 is not configured in .env!');
  }
  const key = `${Date.now()}-${fileName}`;
  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: key,
    Body: buffer,
    ContentType: mimeType
  });

  await s3Client.send(command);
  return key;
}

/**
 * Deletes a file from Cloudflare R2.
 */
async function deleteFile(fileId) {
  if (!s3Client) return;

  try {
    const command = new DeleteObjectCommand({
      Bucket: bucketName,
      Key: fileId
    });
    await s3Client.send(command);
  } catch (err) {
    console.error(`Failed to delete file ${fileId} from Cloudflare R2:`, err.message);
  }
}

/**
 * Downloads a file buffer from Cloudflare R2.
 */
async function downloadFile(fileId) {
  if (!s3Client) {
    throw new Error('Cloudflare R2 is not configured in .env!');
  }

  const command = new GetObjectCommand({
    Bucket: bucketName,
    Key: fileId
  });

  const response = await s3Client.send(command);
  return Buffer.from(await response.Body.transformToByteArray());
}

module.exports = {
  uploadFile,
  deleteFile,
  downloadFile,
  isConfigured: () => {
    return !!(accountId && accessKeyId && secretAccessKey && bucketName);
  }
};
