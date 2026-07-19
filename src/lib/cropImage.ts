import type { Area } from 'react-easy-crop';

const DEFAULT_OUTPUT_SIZE = 512;
const OUTPUT_TYPE = 'image/jpeg';
const OUTPUT_QUALITY = 0.85;

export type CropOutputOptions = {
  width?: number;
  height?: number;
};

function createImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener('load', () => resolve(image));
    image.addEventListener('error', (error) => reject(error));
    image.setAttribute('crossOrigin', 'anonymous');
    image.src = url;
  });
}

export async function getCroppedImageFile(
  imageSrc: string,
  pixelCrop: Area,
  fileName = 'avatar.jpg',
  options?: CropOutputOptions
): Promise<File> {
  const image = await createImage(imageSrc);
  const outputWidth = options?.width ?? DEFAULT_OUTPUT_SIZE;
  const outputHeight = options?.height ?? DEFAULT_OUTPUT_SIZE;
  const canvas = document.createElement('canvas');
  canvas.width = outputWidth;
  canvas.height = outputHeight;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Could not get canvas context');
  }

  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    outputWidth,
    outputHeight
  );

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (result) => {
        if (result) resolve(result);
        else reject(new Error('Failed to create image blob'));
      },
      OUTPUT_TYPE,
      OUTPUT_QUALITY
    );
  });

  const baseName = fileName.replace(/\.[^.]+$/, '') || 'image';
  return new File([blob], `${baseName}.jpg`, { type: OUTPUT_TYPE });
}
