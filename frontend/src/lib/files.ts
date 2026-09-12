import type { GeneratedMinutes } from "../types";

export function canPreviewFile(file: GeneratedMinutes) {
  const extension = file.filename.split(".").pop()?.toLowerCase() || "";
  return file.mimeType.startsWith("image/") || file.mimeType === "application/pdf" || ["pdf", "txt", "png", "jpg", "jpeg", "gif", "webp"].includes(extension);
}

export function parseFilenameFromDisposition(disposition: string) {
  const encodedMatch = disposition.match(/filename\*=UTF-8''([^;]+)/i);
  if (encodedMatch?.[1]) {
    return decodeURIComponent(encodedMatch[1]);
  }
  const filenameMatch = disposition.match(/filename="?([^"]+)"?/);
  return filenameMatch?.[1] || "";
}

export function inferMimeType(filename: string) {
  const extension = filename.split(".").pop()?.toLowerCase() || "";
  const mimeTypes: Record<string, string> = {
    gif: "image/gif",
    jpeg: "image/jpeg",
    jpg: "image/jpeg",
    pdf: "application/pdf",
    png: "image/png",
    txt: "text/plain;charset=utf-8",
    webp: "image/webp",
  };
  return mimeTypes[extension] || "";
}

export function formatBytes(bytes: number) {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
