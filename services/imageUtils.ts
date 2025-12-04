import { SplitDirection } from '../types';

export const readFileAsDataURL = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

export const loadImage = (src: string): Promise<HTMLImageElement> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
};

/**
 * Splits an image into two parts based on direction.
 * Returns an array of two base64 strings (Part 1, Part 2).
 */
export const splitImage = async (
  imageSrc: string,
  direction: SplitDirection
): Promise<[string, string]> => {
  const img = await loadImage(imageSrc);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  if (!ctx) throw new Error('Could not get canvas context');

  const w = img.width;
  const h = img.height;

  let part1Base64 = '';
  let part2Base64 = '';

  if (direction === SplitDirection.Horizontal) {
    // Split Left/Right
    const halfWidth = Math.floor(w / 2);
    
    // Part 1: Left
    canvas.width = halfWidth;
    canvas.height = h;
    ctx.drawImage(img, 0, 0, halfWidth, h, 0, 0, halfWidth, h);
    part1Base64 = canvas.toDataURL('image/png');

    // Part 2: Right
    ctx.clearRect(0, 0, halfWidth, h);
    ctx.drawImage(img, halfWidth, 0, halfWidth, h, 0, 0, halfWidth, h);
    part2Base64 = canvas.toDataURL('image/png');
  } else {
    // Split Top/Bottom
    const halfHeight = Math.floor(h / 2);

    // Part 1: Top
    canvas.width = w;
    canvas.height = halfHeight;
    ctx.drawImage(img, 0, 0, w, halfHeight, 0, 0, w, halfHeight);
    part1Base64 = canvas.toDataURL('image/png');

    // Part 2: Bottom
    ctx.clearRect(0, 0, w, halfHeight);
    ctx.drawImage(img, 0, halfHeight, w, halfHeight, 0, 0, w, halfHeight);
    part2Base64 = canvas.toDataURL('image/png');
  }

  return [part1Base64, part2Base64];
};
