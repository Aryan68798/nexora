import { supabaseAdmin } from '../lib/supabaseAdmin.js';
import { AppError } from '../utils/AppError.js';

/**
 * Validates file buffer magic bytes to ensure true JPEG, PNG, or WebP image formats.
 * Rejects SVGs and executable content.
 * @param {Buffer} buffer - Binary file buffer
 * @returns {{ mimeType: string, ext: string } | null} Detected format or null if invalid
 */
export function detectImageType(buffer) {
  if (!buffer || buffer.length < 12) return null;

  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { mimeType: 'image/jpeg', ext: 'jpg' };
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return { mimeType: 'image/png', ext: 'png' };
  }

  // WebP: RIFF ... WEBP
  if (
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50
  ) {
    return { mimeType: 'image/webp', ext: 'webp' };
  }

  // Reject SVG and all other formats
  return null;
}

/**
 * Validates receipt file buffer magic bytes:
 * Supports true JPEG, PNG, WebP image formats AND PDF documents (%PDF-).
 * Rejects SVGs and executable content.
 * @param {Buffer} buffer - Binary file buffer
 * @returns {{ mimeType: string, ext: string } | null} Detected format or null if invalid
 */
export function detectReceiptFileType(buffer) {
  if (!buffer || buffer.length < 5) return null;

  // Check image formats first (JPEG, PNG, WebP)
  const imageType = detectImageType(buffer);
  if (imageType) return imageType;

  // PDF: %PDF- (hex: 25 50 44 46 2D)
  if (
    buffer[0] === 0x25 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x44 &&
    buffer[3] === 0x46 &&
    buffer[4] === 0x2d
  ) {
    return { mimeType: 'application/pdf', ext: 'pdf' };
  }

  return null;
}

export class StorageService {
  /**
   * Internal helper to verify Supabase Admin client availability.
   * @private
   * @returns {import('@supabase/supabase-js').SupabaseClient}
   */
  getClient() {
    if (!supabaseAdmin) {
      throw new AppError(503, 'STORAGE_NOT_CONFIGURED', 'Storage service is not configured');
    }
    return supabaseAdmin;
  }

  /**
   * Uploads a file buffer to a public Supabase Storage bucket and returns its public URL.
   * @param {string} bucket - Target bucket name
   * @param {string} path - Storage file path
   * @param {Buffer} buffer - File buffer
   * @param {string} mimeType - MIME content type
   * @returns {Promise<string>} Public URL of uploaded file
   */
  async uploadPublicFile(bucket, path, buffer, mimeType) {
    const client = this.getClient();

    const { error: uploadError } = await client.storage.from(bucket).upload(path, buffer, {
      contentType: mimeType,
      upsert: true,
    });

    if (uploadError) {
      throw AppError.badRequest(`Storage upload failed: ${uploadError.message}`);
    }

    const { data } = client.storage.from(bucket).getPublicUrl(path);
    if (!data?.publicUrl) {
      throw AppError.internal('Failed to generate public URL for uploaded file');
    }

    return data.publicUrl;
  }

  /**
   * Uploads a file buffer to a private Supabase Storage bucket and returns its storage path.
   * Private files must never return a public URL; use getSignedUrl for access.
   * @param {string} bucket - Target bucket name
   * @param {string} path - Storage file path
   * @param {Buffer} buffer - File buffer
   * @param {string} mimeType - MIME content type
   * @returns {Promise<string>} Storage path of uploaded file
   */
  async uploadPrivateFile(bucket, path, buffer, mimeType) {
    const client = this.getClient();

    const { error: uploadError } = await client.storage.from(bucket).upload(path, buffer, {
      contentType: mimeType,
      upsert: true,
    });

    if (uploadError) {
      throw AppError.badRequest(`Storage upload failed: ${uploadError.message}`);
    }

    return path;
  }

  /**
   * Deletes a file from a Supabase Storage bucket.
   * @param {string} bucket - Target bucket name
   * @param {string} path - Storage file path
   * @returns {Promise<void>}
   */
  async deleteFile(bucket, path) {
    if (!path) return;
    try {
      const client = this.getClient();
      await client.storage.from(bucket).remove([path]);
    } catch {
      // Ignore deletion errors on cleanup
    }
  }

  /**
   * Generates a signed temporary URL for accessing a private storage object.
   * @param {string} bucket - Target bucket name
   * @param {string} path - Storage file path
   * @param {number} [seconds=3600] - Expiry time in seconds
   * @returns {Promise<string>} Temporary signed URL
   */
  async getSignedUrl(bucket, path, seconds = 3600) {
    const client = this.getClient();
    const { data, error } = await client.storage.from(bucket).createSignedUrl(path, seconds);

    if (error || !data?.signedUrl) {
      throw AppError.badRequest(`Failed to generate signed URL: ${error?.message || 'unknown error'}`);
    }

    return data.signedUrl;
  }
}

export const storageService = new StorageService();
