/**
 * 写真ファイルを DataURL に変換しつつ縮小する。
 * localStorage の容量制約（〜5MB）に配慮し、長辺を maxEdge に収め JPEG 圧縮する。
 * Canvas API を使うためブラウザ専用。
 */
export async function fileToDownscaledDataUrl(
  file: File,
  maxEdge = 800,
  quality = 0.7
): Promise<string> {
  const dataUrl = await readFileAsDataUrl(file);
  try {
    return await downscale(dataUrl, maxEdge, quality);
  } catch {
    // 縮小に失敗したら元の DataURL をそのまま返す
    return dataUrl;
  }
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function downscale(
  dataUrl: string,
  maxEdge: number,
  quality: number
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxEdge / Math.max(img.width, img.height));
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("canvas context unavailable"));
        return;
      }
      ctx.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL("image/jpeg", quality));
    };
    img.onerror = () => reject(new Error("image load failed"));
    img.src = dataUrl;
  });
}
