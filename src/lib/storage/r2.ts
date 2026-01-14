/**
 * R2 Storage Client
 *
 * Provides utilities for interacting with Cloudflare R2 storage
 * for bonsai image uploads.
 */

/**
 * R2 bucket interface from Cloudflare Workers
 */
export interface R2BucketBinding {
  put(
    key: string,
    value: ReadableStream | ArrayBuffer | ArrayBufferView | string | null,
    options?: R2PutOptions
  ): Promise<R2Object | null>;
  get(key: string, options?: R2GetOptions): Promise<R2ObjectBody | null>;
  delete(keys: string | string[]): Promise<void>;
  list(options?: R2ListOptions): Promise<R2Objects>;
  head(key: string): Promise<R2Object | null>;
}

export interface R2PutOptions {
  httpMetadata?: R2HTTPMetadata;
  customMetadata?: Record<string, string>;
  md5?: ArrayBuffer | string;
}

export interface R2GetOptions {
  onlyIf?: R2Conditional;
  range?: R2Range;
}

export interface R2ListOptions {
  prefix?: string;
  limit?: number;
  cursor?: string;
  delimiter?: string;
  include?: ("httpMetadata" | "customMetadata")[];
}

export interface R2HTTPMetadata {
  contentType?: string;
  contentLanguage?: string;
  contentDisposition?: string;
  contentEncoding?: string;
  cacheControl?: string;
}

export interface R2Conditional {
  etagMatches?: string;
  etagDoesNotMatch?: string;
  uploadedBefore?: Date;
  uploadedAfter?: Date;
}

export interface R2Range {
  offset?: number;
  length?: number;
  suffix?: number;
}

export interface R2Object {
  key: string;
  version: string;
  size: number;
  etag: string;
  httpEtag: string;
  checksums: R2Checksums;
  uploaded: Date;
  httpMetadata?: R2HTTPMetadata;
  customMetadata?: Record<string, string>;
}

export interface R2ObjectBody extends R2Object {
  body: ReadableStream;
  bodyUsed: boolean;
  arrayBuffer(): Promise<ArrayBuffer>;
  text(): Promise<string>;
  json<T>(): Promise<T>;
  blob(): Promise<Blob>;
}

export interface R2Objects {
  objects: R2Object[];
  truncated: boolean;
  cursor?: string;
  delimitedPrefixes: string[];
}

export interface R2Checksums {
  md5?: ArrayBuffer;
  sha1?: ArrayBuffer;
  sha256?: ArrayBuffer;
  sha384?: ArrayBuffer;
  sha512?: ArrayBuffer;
}

/**
 * Generate a unique object key for a bonsai image
 *
 * @param bonsaiId - The bonsai ID
 * @param type - "original" or "thumbnail"
 * @param extension - File extension (e.g., "jpg", "webp")
 * @returns Object key in format: bonsai/{bonsaiId}/{type}/{uuid}.{ext}
 */
export function generateImageKey(
  bonsaiId: string,
  type: "original" | "thumbnail",
  extension: string
): string {
  const uuid = crypto.randomUUID();
  const normalizedExt = extension.toLowerCase().replace(/^\./, "");
  return `bonsai/${bonsaiId}/${type}/${uuid}.${normalizedExt}`;
}

/**
 * Parse an image key to extract components
 *
 * @param key - The object key
 * @returns Parsed components or null if invalid
 */
export function parseImageKey(key: string): {
  bonsaiId: string;
  type: "original" | "thumbnail";
  filename: string;
} | null {
  const match = key.match(/^bonsai\/([^/]+)\/(original|thumbnail)\/([^/]+)$/);
  if (!match) return null;

  return {
    bonsaiId: match[1],
    type: match[2] as "original" | "thumbnail",
    filename: match[3],
  };
}

/**
 * Upload an image to R2
 *
 * @param bucket - R2 bucket binding
 * @param key - Object key
 * @param data - Image data as ArrayBuffer
 * @param contentType - MIME type of the image
 * @returns R2Object or null on failure
 */
export async function uploadImage(
  bucket: R2BucketBinding,
  key: string,
  data: ArrayBuffer,
  contentType: string
): Promise<R2Object | null> {
  try {
    const result = await bucket.put(key, data, {
      httpMetadata: {
        contentType,
        cacheControl: "public, max-age=31536000, immutable",
      },
    });
    return result;
  } catch (error) {
    console.error("Failed to upload image to R2:", error);
    return null;
  }
}

/**
 * Delete an image from R2
 *
 * @param bucket - R2 bucket binding
 * @param key - Object key to delete
 */
export async function deleteImage(
  bucket: R2BucketBinding,
  key: string
): Promise<void> {
  try {
    await bucket.delete(key);
  } catch (error) {
    console.error("Failed to delete image from R2:", error);
    throw error;
  }
}

/**
 * Delete multiple images from R2
 *
 * @param bucket - R2 bucket binding
 * @param keys - Array of object keys to delete
 */
export async function deleteImages(
  bucket: R2BucketBinding,
  keys: string[]
): Promise<void> {
  if (keys.length === 0) return;

  try {
    await bucket.delete(keys);
  } catch (error) {
    console.error("Failed to delete images from R2:", error);
    throw error;
  }
}

/**
 * Get an image from R2
 *
 * @param bucket - R2 bucket binding
 * @param key - Object key
 * @returns R2ObjectBody or null if not found
 */
export async function getImage(
  bucket: R2BucketBinding,
  key: string
): Promise<R2ObjectBody | null> {
  try {
    const result = await bucket.get(key);
    return result;
  } catch (error) {
    console.error("Failed to get image from R2:", error);
    return null;
  }
}

/**
 * Check if an image exists in R2
 *
 * @param bucket - R2 bucket binding
 * @param key - Object key
 * @returns true if exists, false otherwise
 */
export async function imageExists(
  bucket: R2BucketBinding,
  key: string
): Promise<boolean> {
  try {
    const result = await bucket.head(key);
    return result !== null;
  } catch {
    return false;
  }
}

/**
 * List images for a bonsai
 *
 * @param bucket - R2 bucket binding
 * @param bonsaiId - Bonsai ID
 * @param type - Optional type filter ("original" or "thumbnail")
 * @returns List of R2Objects
 */
export async function listBonsaiImages(
  bucket: R2BucketBinding,
  bonsaiId: string,
  type?: "original" | "thumbnail"
): Promise<R2Object[]> {
  const prefix = type ? `bonsai/${bonsaiId}/${type}/` : `bonsai/${bonsaiId}/`;
  const allObjects: R2Object[] = [];
  let cursor: string | undefined;

  try {
    do {
      const result = await bucket.list({ prefix, cursor });
      allObjects.push(...result.objects);
      cursor = result.truncated ? result.cursor : undefined;
    } while (cursor);
    return allObjects;
  } catch (error) {
    console.error("Failed to list bonsai images:", error);
    return [];
  }
}

/**
 * Calculate total storage used by a bonsai
 *
 * @param bucket - R2 bucket binding
 * @param bonsaiId - Bonsai ID
 * @returns Total size in bytes
 */
export async function getBonsaiStorageSize(
  bucket: R2BucketBinding,
  bonsaiId: string
): Promise<number> {
  const images = await listBonsaiImages(bucket, bonsaiId);
  return images.reduce((total, img) => total + img.size, 0);
}
