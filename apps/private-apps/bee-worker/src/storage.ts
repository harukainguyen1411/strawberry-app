import { getApps, initializeApp, cert } from "firebase-admin/app";
import { getStorage } from "firebase-admin/storage";
import { createWriteStream } from "node:fs";
import { readFile } from "node:fs/promises";
import { pipeline } from "node:stream/promises";
import { config } from "./config.js";

// ---------------------------------------------------------------------------
// Ensure Admin SDK is initialised (Storage only — no Firestore)
// ---------------------------------------------------------------------------

function ensureApp() {
  if (getApps().length === 0) {
    initializeApp({
      credential: cert(process.env.GOOGLE_APPLICATION_CREDENTIALS as string),
      storageBucket: config.firebase.storageBucket,
    });
  }
}

function getBucket() {
  ensureApp();
  return getStorage().bucket(config.firebase.storageBucket);
}

// ---------------------------------------------------------------------------
// Path helpers
// ---------------------------------------------------------------------------

function tempPath(uid: string, timestamp: string, filename: string): string {
  return `bee-temp/${uid}/${timestamp}/${filename}`;
}

function gsUri(objectPath: string): string {
  return `gs://${config.firebase.storageBucket}/${objectPath}`;
}

// ---------------------------------------------------------------------------
// Download
// ---------------------------------------------------------------------------

/**
 * Download a file from Storage to a local path.
 * sourceStorageUri may be a gs:// URI or a bare object path.
 */
export async function downloadFile(
  sourceStorageUri: string,
  destPath: string,
): Promise<void> {
  const bucket = getBucket();

  let objectPath = sourceStorageUri;
  if (objectPath.startsWith("gs://")) {
    objectPath = objectPath.replace(/^gs:\/\/[^/]+\//, "");
  }

  const file = bucket.file(objectPath);
  const readStream = file.createReadStream();
  const writeStream = createWriteStream(destPath);
  await pipeline(readStream, writeStream);
}

// ---------------------------------------------------------------------------
// Upload
// ---------------------------------------------------------------------------

async function uploadFile(
  localPath: string,
  objectPath: string,
  contentType: string,
): Promise<string> {
  const bucket = getBucket();
  const file = bucket.file(objectPath);
  const contents = await readFile(localPath);
  await file.save(contents, {
    metadata: { contentType },
  });
  return gsUri(objectPath);
}

/**
 * Upload result.docx and return its gs:// URI.
 */
export async function uploadResultDocx(
  localPath: string,
  storagePath: string,
): Promise<string> {
  return uploadFile(
    localPath,
    storagePath,
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  );
}

// ---------------------------------------------------------------------------
// Delete
// ---------------------------------------------------------------------------

/**
 * Delete a file from Storage. Non-fatal — logs on error.
 */
export async function deleteFile(storageUri: string): Promise<void> {
  const bucket = getBucket();

  let objectPath = storageUri;
  if (objectPath.startsWith("gs://")) {
    objectPath = objectPath.replace(/^gs:\/\/[^/]+\//, "");
  }

  await bucket.file(objectPath).delete().catch(() => {
    // Non-fatal — file may already be deleted
  });
}

export { tempPath, gsUri };
