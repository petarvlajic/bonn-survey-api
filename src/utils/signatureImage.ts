import sharp from 'sharp';

/**
 * Convert signature data URL (SVG or PNG/JPEG) to a PNG buffer PDFKit can embed.
 */
export async function signatureToImageBuffer(
  signatureBase64: string | undefined | null
): Promise<Buffer | null> {
  if (!signatureBase64 || typeof signatureBase64 !== 'string') return null;
  const trimmed = signatureBase64.trim();
  if (!trimmed) return null;

  try {
    const isDataUrl = trimmed.includes(',');
    const mimePart = isDataUrl ? trimmed.split(',')[0].toLowerCase() : '';
    const base64Data = isDataUrl ? trimmed.split(',').slice(1).join(',') : trimmed;
    const buffer = Buffer.from(base64Data, 'base64');
    if (buffer.length === 0) return null;

    const head = buffer.subarray(0, Math.min(200, buffer.length)).toString('utf8').trimStart();
    const isSvg = mimePart.includes('svg') || head.startsWith('<svg') || head.startsWith('<?xml');

    if (isSvg) {
      const svgText = buffer.toString('utf8');
      return await sharp(Buffer.from(svgText, 'utf8'), { density: 200 }).png().toBuffer();
    }

    if (mimePart.includes('png') || mimePart.includes('jpeg') || mimePart.includes('jpg')) {
      return buffer;
    }

    return await sharp(buffer).png().toBuffer();
  } catch (e) {
    console.warn('[signatureImage] signatureToImageBuffer failed:', (e as Error).message);
    return null;
  }
}
