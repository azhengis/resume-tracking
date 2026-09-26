import { put, del } from "@vercel/blob";

function parseDataUrl(dataUrl: string): { contentType: string; buffer: Buffer } {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) throw new Error("Not a base64 data URL.");
  return { contentType: match[1], buffer: Buffer.from(match[2], "base64") };
}

/** Uploads a base64 data: URL to Blob storage and returns its public URL. */
export async function uploadDataUrlToBlob(dataUrl: string, pathname: string): Promise<string> {
  const { contentType, buffer } = parseDataUrl(dataUrl);
  const blob = await put(pathname, buffer, {
    access: "public",
    contentType,
    addRandomSuffix: true,
  });
  return blob.url;
}

export async function deleteBlob(url?: string | null) {
  if (!url) return;
  try {
    await del(url);
  } catch {
    // best-effort cleanup — don't fail the request over it
  }
}
