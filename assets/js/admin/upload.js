// Direct, unsigned uploads to Cloudinary (free plan limits: images/PDF 10 MB, video 100 MB).
let cfg = {};
export const setUploadConfig = (c) => { cfg = c || {}; };
export const uploadsReady = () => !!(cfg.cloudName && cfg.uploadPreset);

export function uploadFile(file, onProgress) {
  if (!uploadsReady()) return Promise.reject(new Error('Uploads are not set up yet. Add your Cloudinary details in Settings.'));
  const limit = file.type.startsWith('video/') ? 100 : 10;
  if (file.size > limit * 1024 * 1024) {
    return Promise.reject(new Error(`That file is ${(file.size / 1048576).toFixed(0)} MB. The free plan allows up to ${limit} MB. For long videos, upload to YouTube (unlisted) and paste the link.`));
  }
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `https://api.cloudinary.com/v1_1/${encodeURIComponent(cfg.cloudName.trim())}/auto/upload`);
    xhr.upload.onprogress = (e) => { if (e.lengthComputable) onProgress?.(e.loaded / e.total); };
    xhr.onload = () => {
      let res = null;
      try { res = JSON.parse(xhr.responseText); } catch { /* not JSON */ }
      if (xhr.status >= 200 && xhr.status < 300 && res?.secure_url) {
        resolve({ url: res.secure_url, width: res.width, height: res.height, type: res.resource_type });
      } else {
        reject(new Error(res?.error?.message || `Upload failed (${xhr.status})`));
      }
    };
    xhr.onerror = () => reject(new Error('Network error while uploading.'));
    const fd = new FormData();
    fd.append('file', file);
    fd.append('upload_preset', cfg.uploadPreset.trim());
    xhr.send(fd);
  });
}

// Opens the file picker; resolves with the upload result or null if cancelled.
export function pickAndUpload({ accept = 'image/*,video/*', onProgress } = {}) {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.addEventListener('change', () => {
      const file = input.files?.[0];
      if (!file) { resolve(null); return; }
      uploadFile(file, onProgress).then(resolve, reject);
    });
    input.addEventListener('cancel', () => resolve(null));
    input.click();
  });
}
