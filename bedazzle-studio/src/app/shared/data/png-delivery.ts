/** How a finished PNG actually reached the user — so the UI can report what
 * happened truthfully instead of always saying "Saved". */
export type ExportOutcome = 'shared' | 'downloaded' | 'previewed';

/**
 * Hands a finished PNG blob to the user: the Web Share sheet on platforms
 * that support sharing files (the reliable path on iOS Safari), a normal
 * download otherwise, or a new-tab preview as a last resort. Shared between
 * the freehand and mosaic exporters so this fallback chain lives in one place.
 */
export async function deliverPngBlob(blob: Blob, fileName: string): Promise<ExportOutcome> {
  const file = new File([blob], fileName, { type: 'image/png' });
  const nav = navigator as Navigator & {
    canShare?: (data?: { files?: File[] }) => boolean;
    share?: (data: { files?: File[]; title?: string }) => Promise<void>;
  };

  if (nav.share && nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], title: fileName });
      return 'shared';
    } catch (error) {
      if ((error as DOMException)?.name === 'AbortError') {
        return 'shared';
      }
      // Fall through to the download/preview path below.
    }
  }

  const url = URL.createObjectURL(blob);
  try {
    if ('download' in HTMLAnchorElement.prototype) {
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      link.remove();
      return 'downloaded';
    }

    const opened = window.open(url, '_blank');
    if (!opened) {
      throw new Error('Could not open a preview of the design. Please allow pop-ups and try again.');
    }
    return 'previewed';
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 30_000);
  }
}
