const CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
const UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;
const UPLOAD_URL = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/auto/upload`;

const MAX_UPLOAD_BYTES = 50 * 1024 * 1024; // 50 MB

interface UploadOptions {
  folder: string;
  onProgress?: (percent: number) => void;
  maxBytes?: number;
}

interface CloudinaryResponse {
  secure_url: string;
  public_id: string;
  resource_type: string;
  bytes: number;
  format: string;
}

export async function uploadToCloudinary(
  file: File,
  { folder, onProgress, maxBytes }: UploadOptions
): Promise<CloudinaryResponse> {
  const limit = maxBytes ?? MAX_UPLOAD_BYTES;
  if (file.size > limit) {
    throw new Error(`File too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Maximum allowed is ${(limit / 1024 / 1024).toFixed(0)} MB.`);
  }

  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', UPLOAD_PRESET);
  formData.append('folder', folder);

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', UPLOAD_URL);

    if (onProgress) {
      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          onProgress(Math.round((e.loaded / e.total) * 100));
        }
      });
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(JSON.parse(xhr.responseText));
      } else {
        const body = (() => { try { return JSON.parse(xhr.responseText); } catch { return null; } })();
        const msg = body?.error?.message || xhr.statusText;
        reject(new Error(`Upload failed (${xhr.status}): ${msg}`));
      }
    };

    xhr.onerror = () => reject(new Error('Network error during upload'));
    xhr.send(formData);
  });
}

export async function deleteFromCloudinary(publicId: string): Promise<void> {
  // Unsigned deletion is not supported by Cloudinary.
  // For now, deletions should be handled server-side or skipped.
  console.warn('Cloudinary deletion requires server-side API. Skipping for public_id:', publicId);
}
