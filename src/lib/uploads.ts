/** Catalog uploads go to Vercel Blob (a public store); see README for connecting one. */

export const UPLOAD_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif", "video/mp4", "video/webm", "video/quicktime"];
export const UPLOAD_MAX_BYTES = 500 * 1024 * 1024;

/** Server only: the read-write token appears once a Blob store is connected to the project. */
export function uploadsEnabled() {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}
