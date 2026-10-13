/**
 * Utilidad de optimización y conversión de imágenes electorales a WebP en el cliente.
 * 
 * Por qué en el cliente (Frontend Canvas):
 * 1. Reduce el archivo de 5MB-15MB (cámara de celular) a ~150-300 KB antes de la transmisión.
 * 2. Carga ultrarrápida incluso en conexiones móviles inestables en centros de votación.
 * 3. Al pesar < 350 KB, permite respaldos directos en Firestore en caso de fallas de Cloud Storage.
 * 4. Evita dependencias nativas de servidor (como librerías C++ libvips en Vercel Serverless).
 */

export interface OptimizationResult {
  file: File;
  width: number;
  height: number;
  originalSize: number;
  optimizedSize: number;
  savingsPercent: number;
  isWebP: boolean;
}

export async function convertImageFileToWebP(
  file: File,
  options: { maxDimension?: number; quality?: number } = {}
): Promise<OptimizationResult> {
  const maxDimension = options.maxDimension ?? 1920;
  const quality = options.quality ?? 0.85;

  // Si estamos en un entorno sin DOM (SSR), devolver el archivo original
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return {
      file,
      width: 0,
      height: 0,
      originalSize: file.size,
      optimizedSize: file.size,
      savingsPercent: 0,
      isWebP: file.type === 'image/webp',
    };
  }

  return new Promise((resolve) => {
    const reader = new FileReader();

    const fallbackOriginal = () => {
      resolve({
        file,
        width: 0,
        height: 0,
        originalSize: file.size,
        optimizedSize: file.size,
        savingsPercent: 0,
        isWebP: file.type === 'image/webp',
      });
    };

    reader.onerror = fallbackOriginal;

    reader.onload = () => {
      const img = new Image();
      img.onerror = fallbackOriginal;

      img.onload = () => {
        let width = img.naturalWidth || img.width;
        let height = img.naturalHeight || img.height;

        if (width <= 0 || height <= 0) {
          fallbackOriginal();
          return;
        }

        // Redimensionar manteniendo relación de aspecto
        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');

        if (!ctx) {
          fallbackOriginal();
          return;
        }

        // Fondo blanco (evita negro si hay transparencia)
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);

        // Convertir a WebP
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              fallbackOriginal();
              return;
            }

            const cleanBaseName = file.name.replace(/\.[^/.]+$/, '');
            const webpFileName = `${cleanBaseName}.webp`;
            const webpFile = new File([blob], webpFileName, {
              type: 'image/webp',
              lastModified: Date.now(),
            });

            const origSize = file.size;
            const optSize = webpFile.size;
            const savings = origSize > 0 ? Math.max(0, Math.round(((origSize - optSize) / origSize) * 100)) : 0;

            resolve({
              file: webpFile,
              width,
              height,
              originalSize: origSize,
              optimizedSize: optSize,
              savingsPercent: savings,
              isWebP: true,
            });
          },
          'image/webp',
          quality
        );
      };

      img.src = reader.result as string;
    };

    reader.readAsDataURL(file);
  });
}
