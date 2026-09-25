// Detects an image's real format from its bytes (magic numbers), instead
// of trusting the browser-supplied `File.type` (a client can label any
// file as `image/png`): review finding (MEDIUM, security) on BO-05a's
// `uploadLogo`. Only the 3 formats the form accepts.
export type DetectedImageType = "image/png" | "image/jpeg" | "image/webp";

function startsWith(bytes: Uint8Array, offset: number, signature: number[]): boolean {
  if (bytes.length < offset + signature.length) return false;
  return signature.every((byte, index) => bytes[offset + index] === byte);
}

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const JPEG_SIGNATURE = [0xff, 0xd8, 0xff];
const RIFF_SIGNATURE = [0x52, 0x49, 0x46, 0x46]; // "RIFF"
const WEBP_SIGNATURE = [0x57, 0x45, 0x42, 0x50]; // "WEBP", at offset 8 of a RIFF container

export function detectImageType(bytes: Uint8Array): DetectedImageType | null {
  if (startsWith(bytes, 0, PNG_SIGNATURE)) return "image/png";
  if (startsWith(bytes, 0, JPEG_SIGNATURE)) return "image/jpeg";
  if (startsWith(bytes, 0, RIFF_SIGNATURE) && startsWith(bytes, 8, WEBP_SIGNATURE)) return "image/webp";
  return null;
}

export const IMAGE_EXTENSIONS: Record<DetectedImageType, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};
