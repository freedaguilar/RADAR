import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || '';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * Uploads a File or base64 data string to Supabase Storage inside the specified bucket.
 * Automatically tries to list/create the bucket first to ensure it's provisioned.
 * Falls back safely to base64/data URLs if credentials are not configured or if upload errors occur.
 */
export async function uploadToSupabaseStorage(
  fileOrBase64: File | string,
  bucketName: string = 'images'
): Promise<string> {
  const isConfigured = !!(supabaseUrl && supabaseAnonKey);

  if (!isConfigured) {
    console.warn("Supabase is not configured yet. Returning fallback data URL.");
    if (typeof fileOrBase64 === 'string') {
      return fileOrBase64;
    } else {
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(fileOrBase64);
      });
    }
  }

  // Ensure bucket exists or create it
  try {
    const { data: buckets } = await supabase.storage.listBuckets();
    const exists = buckets?.some(b => b.name === bucketName);
    if (!exists) {
      await supabase.storage.createBucket(bucketName, {
        public: true,
        fileSizeLimit: 5242880, // 5MB limit
      });
    }
  } catch (err) {
    console.error("Checking/creating Supabase Storage bucket failed or skipped:", err);
  }

  let body: Blob | File;
  let ext = 'jpg';
  let mimeType = 'image/jpeg';
  let originalName = 'image.jpg';

  if (typeof fileOrBase64 === 'string') {
    // Parse base64 or dataURL
    const match = fileOrBase64.match(/^data:(image\/[a-z0-9-+.]+);base64,(.*)$/i);
    if (match) {
      mimeType = match[1];
      ext = mimeType.split('/')[1] || 'jpg';
      const rawBase64 = match[2];
      try {
        const binaryStr = window.atob(rawBase64);
        const len = binaryStr.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
          bytes[i] = binaryStr.charCodeAt(i);
        }
        body = new Blob([bytes], { type: mimeType });
      } catch (err) {
        console.error("Base64 string decode failed, using string directly:", err);
        return fileOrBase64;
      }
    } else {
      // Return directly if it's already a non-base64 URL
      return fileOrBase64;
    }
  } else {
    body = fileOrBase64;
    originalName = fileOrBase64.name;
    const parts = originalName.split('.');
    ext = parts[parts.length - 1] || 'jpg';
    mimeType = fileOrBase64.type || 'image/jpeg';
  }

  const timestamp = Date.now();
  const randomStr = Math.random().toString(36).substring(2, 7);
  const finalPath = `uploads/${timestamp}-${randomStr}.${ext}`;

  try {
    const { error } = await supabase.storage
      .from(bucketName)
      .upload(finalPath, body, {
        contentType: mimeType,
        cacheControl: '3600',
        upsert: true,
      });

    if (error) {
      console.error("Supabase Storage upload error, falling back to data URL:", error);
      if (typeof fileOrBase64 === 'string') {
        return fileOrBase64;
      } else {
        return new Promise((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(fileOrBase64);
        });
      }
    }

    // Return the absolute public URL
    const { data: urlData } = supabase.storage.from(bucketName).getPublicUrl(finalPath);
    return urlData.publicUrl;
  } catch (uploadException) {
    console.error("Upload exception triggered:", uploadException);
    if (typeof fileOrBase64 === 'string') {
      return fileOrBase64;
    } else {
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(fileOrBase64);
      });
    }
  }
}

