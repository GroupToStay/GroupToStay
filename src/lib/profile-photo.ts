const OUTPUT_SIZE = 72;
const OUTPUT_QUALITY = 0.76;
const MAX_DATA_URL_LENGTH = 3_500;

export const PROFILE_PHOTO_MAX_BYTES = 8 * 1024 * 1024;
export const PROFILE_PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];

function loadImage(source: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("image_decode_failed"));
    image.src = source;
  });
}

function readFile(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("image_read_failed"));
    reader.readAsDataURL(file);
  });
}

export async function prepareProfilePhoto(file: File) {
  const source = await readFile(file);
  const image = await loadImage(source);
  const side = Math.min(image.naturalWidth, image.naturalHeight);
  const sourceX = Math.max(0, (image.naturalWidth - side) / 2);
  const sourceY = Math.max(0, (image.naturalHeight - side) / 2);
  const canvas = document.createElement("canvas");
  canvas.width = OUTPUT_SIZE;
  canvas.height = OUTPUT_SIZE;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("canvas_unavailable");
  context.drawImage(image, sourceX, sourceY, side, side, 0, 0, OUTPUT_SIZE, OUTPUT_SIZE);
  const result = canvas.toDataURL("image/webp", OUTPUT_QUALITY);
  if (result.length > MAX_DATA_URL_LENGTH) {
    const compressed = canvas.toDataURL("image/webp", 0.58);
    if (compressed.length > MAX_DATA_URL_LENGTH) throw new Error("image_output_too_large");
    return compressed;
  }
  return result;
}
