export function toGrayScale(imageData) {
  const data = imageData.data;
  for (let i = 0; i < data.length; i += 4) {
    const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    data[i] = data[i + 1] = data[i + 2] = gray;
  }
  return imageData;
}

export function threshold(imageData, value = 128) {
  const data = imageData.data;
  for (let i = 0; i < data.length; i += 4) {
    const v = data[i] > value ? 255 : 0;
    data[i] = data[i + 1] = data[i + 2] = v;
  }
  return imageData;
}

export function copyImageData(ctx, src) {
  return new ImageData(new Uint8ClampedArray(src.data), src.width, src.height);
}
