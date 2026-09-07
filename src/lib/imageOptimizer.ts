/**
 * Client-Side Image Optimizer Utility
 * Automatically downscales and compresses high-resolution camera photos (from mobile phones or tablets)
 * before uploading or converting to data URLs, ensuring they stay well under 2MB.
 */

export interface OptimizedImageResult {
  dataUrl: string;
  file: File;
  originalSize: number;
  optimizedSize: number;
  wasOptimized: boolean;
}

export async function optimizeImageFile(
  file: File,
  maxDimension = 1600,
  initialQuality = 0.82
): Promise<OptimizedImageResult> {
  // If not an image (e.g. PDF document in intake waybill), return as-is
  if (!file.type.startsWith("image/")) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        resolve({
          dataUrl: reader.result as string,
          file,
          originalSize: file.size,
          optimizedSize: file.size,
          wasOptimized: false,
        });
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => {
        // Fallback: If image decode fails, resolve original
        resolve({
          dataUrl: reader.result as string,
          file,
          originalSize: file.size,
          optimizedSize: file.size,
          wasOptimized: false,
        });
      };

      img.onload = () => {
        try {
          let width = img.naturalWidth || img.width;
          let height = img.naturalHeight || img.height;

          // Scale down proportionally if either dimension exceeds maxDimension
          if (width > maxDimension || height > maxDimension) {
            if (width > height) {
              height = Math.round((height * maxDimension) / width);
              width = maxDimension;
            } else {
              width = Math.round((width * maxDimension) / height);
              height = maxDimension;
            }
          }

          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext("2d");
          if (!ctx) {
            resolve({
              dataUrl: reader.result as string,
              file,
              originalSize: file.size,
              optimizedSize: file.size,
              wasOptimized: false,
            });
            return;
          }

          // Use high quality image smoothing
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = "high";
          ctx.drawImage(img, 0, 0, width, height);

          // Compress to JPEG format
          let quality = initialQuality;
          let dataUrl = canvas.toDataURL("image/jpeg", quality);

          // If still > 1.8MB (rare for 1600px), step down quality progressively
          while (dataUrl.length > 1.8 * 1024 * 1024 && quality > 0.4) {
            quality -= 0.15;
            dataUrl = canvas.toDataURL("image/jpeg", quality);
          }

          // Calculate approximate byte size of base64 data URL
          const base64Content = dataUrl.split(",")[1] || "";
          const approxBytes = Math.round((base64Content.length * 3) / 4);

          // Convert canvas to a File object as well
          canvas.toBlob(
            (blob) => {
              const optimizedFile = blob
                ? new File([blob], file.name.replace(/\.[^/.]+$/, "") + ".jpg", {
                    type: "image/jpeg",
                    lastModified: Date.now(),
                  })
                : file;

              resolve({
                dataUrl,
                file: optimizedFile,
                originalSize: file.size,
                optimizedSize: approxBytes,
                wasOptimized: true,
              });
            },
            "image/jpeg",
            quality
          );
        } catch {
          // If canvas processing fails, fallback gracefully
          resolve({
            dataUrl: reader.result as string,
            file,
            originalSize: file.size,
            optimizedSize: file.size,
            wasOptimized: false,
          });
        }
      };

      img.src = reader.result as string;
    };

    reader.readAsDataURL(file);
  });
}
