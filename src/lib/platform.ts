/** Best-effort platform detection for OS-appropriate shortcut labels. */
export function isMac(): boolean {
  if (typeof navigator === 'undefined') return false;
  const s = `${navigator.platform ?? ''} ${navigator.userAgent ?? ''}`;
  return /Mac|iPhone|iPad|iPod/i.test(s);
}

/** The primary modifier key label for this OS ("⌘" on macOS, else "Ctrl"). */
export function modLabel(): string {
  return isMac() ? '⌘' : 'Ctrl';
}
