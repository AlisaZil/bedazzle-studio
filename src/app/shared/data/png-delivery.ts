/**
 * Explicit delivery actions for a rendered PNG blob — split into two
 * standalone functions (rather than one auto-picking fallback chain) so the
 * SaveDialog's Download and Share buttons can each be a real, user-chosen
 * action on the same already-rendered file.
 */

function canShareFiles(file: File): boolean {
  const nav = navigator as Navigator & { canShare?: (data?: { files?: File[] }) => boolean };
  return !!navigator.share && !!nav.canShare?.({ files: [file] });
}

/** Whether `shareBlob` has a real chance of working on this device/browser —
 * used to hide/disable the Share button rather than offering a dead end. */
export function canShareBlob(): boolean {
  const nav = navigator as Navigator & { canShare?: (data?: { files?: File[] }) => boolean };
  return !!navigator.share && !!nav.canShare;
}

/** Opens the platform share sheet with the file. Resolves `true` if the
 * share actually completed, `false` if the user cancelled or the platform
 * can't share files at all (never throws for either of those cases). */
export async function shareBlob(blob: Blob, fileName: string): Promise<boolean> {
  const file = new File([blob], fileName, { type: 'image/png' });
  if (!canShareFiles(file)) return false;
  try {
    await navigator.share!({ files: [file], title: fileName });
    return true;
  } catch (error) {
    if ((error as DOMException)?.name === 'AbortError') return false;
    throw error;
  }
}

/** Triggers a normal browser download of the blob, falling back to opening
 * it in a new tab on platforms with no `<a download>` support. */
export function downloadBlob(blob: Blob, fileName: string): void {
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
      return;
    }

    const opened = window.open(url, '_blank');
    if (!opened) {
      throw new Error('Could not open a preview of the design. Please allow pop-ups and try again.');
    }
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 30_000);
  }
}
