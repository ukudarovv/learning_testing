import type { Area } from 'react-easy-crop';

function createImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener('load', () => resolve(image));
    image.addEventListener('error', (err) => reject(err));
    if (!url.startsWith('blob:')) {
      image.crossOrigin = 'anonymous';
    }
    image.src = url;
  });
}

function getRadianAngle(degreeValue: number) {
  return (degreeValue * Math.PI) / 180;
}

function rotateSize(width: number, height: number, rotation: number) {
  const rotRad = getRadianAngle(rotation);
  return {
    width: Math.abs(Math.cos(rotRad) * width) + Math.abs(Math.sin(rotRad) * height),
    height: Math.abs(Math.sin(rotRad) * width) + Math.abs(Math.cos(rotRad) * height),
  };
}

/** Обрезка по области из react-easy-crop (croppedAreaPixels) + поворот. */
export async function getCroppedImageBlob(
  imageSrc: string,
  pixelCrop: Area,
  rotation = 0,
  mimeType: 'image/jpeg' | 'image/webp' = 'image/jpeg',
  quality = 0.92
): Promise<Blob> {
  const image = await createImage(imageSrc);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D not supported');

  const rotRad = getRadianAngle(rotation);
  const { width: bBoxWidth, height: bBoxHeight } = rotateSize(image.width, image.height, rotation);

  canvas.width = bBoxWidth;
  canvas.height = bBoxHeight;

  ctx.translate(bBoxWidth / 2, bBoxHeight / 2);
  ctx.rotate(rotRad);
  ctx.translate(-image.width / 2, -image.height / 2);
  ctx.drawImage(image, 0, 0);

  const data = ctx.getImageData(
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height
  );

  const croppedCanvas = document.createElement('canvas');
  const croppedCtx = croppedCanvas.getContext('2d');
  if (!croppedCtx) throw new Error('Canvas 2D not supported');

  croppedCanvas.width = pixelCrop.width;
  croppedCanvas.height = pixelCrop.height;
  croppedCtx.putImageData(data, 0, 0);

  const maxEdge = 1024;
  let outW = croppedCanvas.width;
  let outH = croppedCanvas.height;
  if (outW > maxEdge || outH > maxEdge) {
    const scale = maxEdge / Math.max(outW, outH);
    outW = Math.round(outW * scale);
    outH = Math.round(outH * scale);
    const scaleCanvas = document.createElement('canvas');
    scaleCanvas.width = outW;
    scaleCanvas.height = outH;
    const sctx = scaleCanvas.getContext('2d');
    if (!sctx) throw new Error('Canvas 2D not supported');
    sctx.imageSmoothingEnabled = true;
    sctx.imageSmoothingQuality = 'high';
    sctx.drawImage(croppedCanvas, 0, 0, outW, outH);
    return new Promise((resolve, reject) => {
      scaleCanvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error('toBlob failed'))),
        mimeType,
        quality
      );
    });
  }

  return new Promise((resolve, reject) => {
    croppedCanvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('toBlob failed'))),
      mimeType,
      quality
    );
  });
}

export function blobToProfilePhotoFile(blob: Blob, originalName: string): File {
  const base = originalName.replace(/\.[^.]+$/, '') || 'profile-photo';
  const ext = blob.type === 'image/webp' ? 'webp' : 'jpg';
  return new File([blob], `${base}-edited.${ext}`, { type: blob.type || 'image/jpeg' });
}
