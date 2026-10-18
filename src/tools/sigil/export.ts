import type { BuiltSvg } from './render';

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function downloadSvg(built: BuiltSvg, filename: string) {
  download(new Blob([built.svg], { type: 'image/svg+xml' }), filename + '.svg');
}

/** Renders the SVG to a PNG `width` pixels wide (height follows the aspect ratio). */
export async function renderPng(built: BuiltSvg, width: number): Promise<Blob> {
  const height = Math.round((width * built.height) / built.width);
  const svg = built.svg.replace(/width="[^"]*" height="[^"]*"/, `width="${width}" height="${height}"`);
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
  try {
    const img = new Image();
    img.decoding = 'async';
    img.src = url;
    await img.decode();
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    canvas.getContext('2d')!.drawImage(img, 0, 0, width, height);
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('PNG encoding failed'))), 'image/png'),
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function downloadPng(built: BuiltSvg, width: number, filename: string) {
  download(await renderPng(built, width), `${filename}-${width}.png`);
}

/** Copies the PNG to the clipboard. Returns false if the browser doesn't allow it. */
export async function copyPng(built: BuiltSvg, width: number): Promise<boolean> {
  if (!navigator.clipboard || typeof ClipboardItem === 'undefined') return false;
  try {
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': renderPng(built, width) })]);
    return true;
  } catch {
    return false;
  }
}
