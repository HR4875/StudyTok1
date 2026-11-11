"use client";
// 올린 사진을 AI가 읽기 좋은 크기로 줄여 JPEG(base64)로 바꾼다. 요청 본문 4.5MB 제한 아래로 유지.

export async function imageToJpeg(file: File, maxSide = 1280, quality = 0.82): Promise<string> {
  let bmp: ImageBitmap | HTMLImageElement;
  try {
    bmp = await createImageBitmap(file);
  } catch {
    // 일부 브라우저(구형 Safari)는 createImageBitmap이 실패한다
    bmp = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error(`${file.name}: 사진을 열 수 없어요`));
      img.src = URL.createObjectURL(file);
    });
  }
  const w = "naturalWidth" in bmp ? bmp.naturalWidth : bmp.width;
  const h = "naturalHeight" in bmp ? bmp.naturalHeight : bmp.height;
  const scale = Math.min(1, maxSide / Math.max(w, h));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(w * scale));
  canvas.height = Math.max(1, Math.round(h * scale));
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  if ("close" in bmp) bmp.close();
  const url = canvas.toDataURL("image/jpeg", quality);
  canvas.width = canvas.height = 0;
  return url.slice(url.indexOf(",") + 1);
}
