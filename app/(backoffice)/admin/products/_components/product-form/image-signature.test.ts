import { describe, expect, it } from "vitest";
import { detectImageType, IMAGE_EXTENSIONS } from "./image-signature";

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const JPEG_SIGNATURE = [0xff, 0xd8, 0xff, 0xe0];
// RIFF <4-byte size> WEBP
const WEBP_SIGNATURE = [0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50];

function bytes(header: number[], padTo = header.length): Uint8Array {
  const buffer = new Uint8Array(Math.max(header.length, padTo));
  buffer.set(header);
  return buffer;
}

describe("detectImageType", () => {
  it("recognizes a real PNG signature", () => {
    expect(detectImageType(bytes(PNG_SIGNATURE, 20))).toBe("image/png");
  });

  it("recognizes a real JPEG signature", () => {
    expect(detectImageType(bytes(JPEG_SIGNATURE, 20))).toBe("image/jpeg");
  });

  it("recognizes a real WEBP signature (RIFF … WEBP)", () => {
    expect(detectImageType(bytes(WEBP_SIGNATURE, 20))).toBe("image/webp");
  });

  it("returns null for HTML bytes masquerading as an image", () => {
    const html = new TextEncoder().encode("<html><body>not an image</body></html>");
    expect(detectImageType(html)).toBeNull();
  });

  it("returns null for an empty or too-short buffer", () => {
    expect(detectImageType(new Uint8Array(0))).toBeNull();
    expect(detectImageType(new Uint8Array([0x89, 0x50]))).toBeNull();
  });

  it("does not match a RIFF file that isn't WEBP (e.g. a WAV file)", () => {
    const wav = [0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x41, 0x56, 0x45]; // RIFF....WAVE
    expect(detectImageType(bytes(wav, 20))).toBeNull();
  });
});

describe("IMAGE_EXTENSIONS", () => {
  it("maps every detectable type to a file extension", () => {
    expect(IMAGE_EXTENSIONS["image/png"]).toBe("png");
    expect(IMAGE_EXTENSIONS["image/jpeg"]).toBe("jpg");
    expect(IMAGE_EXTENSIONS["image/webp"]).toBe("webp");
  });
});
