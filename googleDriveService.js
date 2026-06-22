const { google } = require('googleapis');
const stream = require('stream');

const SCOPES = ['https://www.googleapis.com/auth/drive.file', 'https://www.googleapis.com/auth/drive'];

function getDriveClient() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  let privateKey = process.env.GOOGLE_PRIVATE_KEY;

  if (!email || !privateKey) {
    return null;
  }

  // Handle newline characters in private key
  privateKey = privateKey.replace(/\\n/g, '\n').replace(/"/g, '');

  const auth = new google.auth.JWT(
    email,
    null,
    privateKey,
    SCOPES
  );

  return google.drive({ version: 'v3', auth });
}

/**
 * Uploads a file buffer to Google Drive.
 * Returns the Google Drive file ID.
 */
async function uploadFile(fileName, buffer, mimeType = 'application/pdf') {
  const drive = getDriveClient();
  if (!drive) {
    throw new Error('Google Drive API credentials are not configured in .env!');
  }

  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
  const fileMetadata = {
    name: fileName,
  };

  if (folderId && folderId.trim().length > 0) {
    fileMetadata.parents = [folderId.trim()];
  }

  const bufferStream = new stream.PassThrough();
  bufferStream.end(buffer);

  const media = {
    mimeType: mimeType,
    body: bufferStream,
  };

  const response = await drive.files.create({
    requestBody: fileMetadata,
    media: media,
    fields: 'id',
  });

  return response.data.id;
}

/**
 * Deletes a file from Google Drive.
 */
async function deleteFile(fileId) {
  const drive = getDriveClient();
  if (!drive) return;

  try {
    await drive.files.delete({ fileId });
  } catch (err) {
    console.error(`Failed to delete file ${fileId} from Google Drive:`, err.message);
  }
}

/**
 * Downloads a file buffer from Google Drive.
 */
async function downloadFile(fileId) {
  const drive = getDriveClient();
  if (!drive) {
    throw new Error('Google Drive API credentials are not configured in .env!');
  }

  const response = await drive.files.get(
    { fileId: fileId, alt: 'media' },
    { responseType: 'arraybuffer' }
  );

  return Buffer.from(response.data);
}

module.exports = {
  uploadFile,
  deleteFile,
  downloadFile,
  isConfigured: () => {
    return !!(process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL && process.env.GOOGLE_PRIVATE_KEY);
  }
};
