export type ImageDerivative = {
  blob: Blob;
  width: number;
  height: number;
};

export type ProductImageDerivatives = {
  full: ImageDerivative;
  card: ImageDerivative;
  thumb: ImageDerivative;
};

const PRESETS = {
  full: { maxWidth: 1600, maxHeight: 2000, quality: 0.9 },
  card: { maxWidth: 720, maxHeight: 900, quality: 0.84 },
  thumb: { maxWidth: 240, maxHeight: 300, quality: 0.78 },
} as const;

async function loadImageSource(file: File) {
  if (typeof createImageBitmap === "function") {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    return {
      width: bitmap.width,
      height: bitmap.height,
      draw: (ctx: CanvasRenderingContext2D, width: number, height: number) =>
        ctx.drawImage(bitmap, 0, 0, width, height),
      dispose: () => bitmap.close(),
    };
  }

  const objectUrl = URL.createObjectURL(file);
  const image = new Image();
  image.decoding = "async";
  image.src = objectUrl;
  await image.decode();

  return {
    width: image.naturalWidth,
    height: image.naturalHeight,
    draw: (ctx: CanvasRenderingContext2D, width: number, height: number) =>
      ctx.drawImage(image, 0, 0, width, height),
    dispose: () => URL.revokeObjectURL(objectUrl),
  };
}

function fitDimensions(width: number, height: number, maxWidth: number, maxHeight: number) {
  const scale = Math.min(1, maxWidth / width, maxHeight / height);
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

async function canvasToWebp(canvas: HTMLCanvasElement, quality: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("O navegador não conseguiu otimizar a imagem em WebP."));
          return;
        }
        resolve(blob);
      },
      "image/webp",
      quality,
    );
  });
}

export async function createProductImageDerivatives(file: File): Promise<ProductImageDerivatives> {
  const source = await loadImageSource(file);

  try {
    const result = {} as ProductImageDerivatives;

    for (const [key, preset] of Object.entries(PRESETS) as Array<
      [keyof ProductImageDerivatives, (typeof PRESETS)[keyof typeof PRESETS]]
    >) {
      const dimensions = fitDimensions(
        source.width,
        source.height,
        preset.maxWidth,
        preset.maxHeight,
      );
      const canvas = document.createElement("canvas");
      canvas.width = dimensions.width;
      canvas.height = dimensions.height;
      const context = canvas.getContext("2d", { alpha: true });

      if (!context) {
        throw new Error("O navegador não conseguiu preparar a imagem.");
      }

      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = "high";
      source.draw(context, dimensions.width, dimensions.height);

      result[key] = {
        blob: await canvasToWebp(canvas, preset.quality),
        width: dimensions.width,
        height: dimensions.height,
      };
    }

    return result;
  } finally {
    source.dispose();
  }
}
