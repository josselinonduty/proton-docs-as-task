/**
 * Re-brands the Docs shell (tab favicon and in-app document icon) while the
 * open document is a task board.
 *
 * The board is detected inside the sandboxed editor iframe, but the favicon
 * and the header live in the outer shell — a different origin — so the editor
 * frame announces its state with `postMessage` and a shell content script
 * applies it.
 */

export const BRANDING_MESSAGE = 'pdt:board-active';

export interface BrandingMessage {
  type: typeof BRANDING_MESSAGE;
  active: boolean;
}

export const EDITOR_ORIGIN = 'https://docs-editor.proton.me';
export const SHELL_ORIGIN = 'https://docs.proton.me';

/** Tell the Docs shell whether this document is a task board (no-op in the shell itself). */
export function announceBoard(active: boolean, win: Window = window): void {
  if (win.parent === win) return;
  const message: BrandingMessage = { type: BRANDING_MESSAGE, active };
  win.parent.postMessage(message, SHELL_ORIGIN);
}

export function isBrandingMessage(data: unknown): data is BrandingMessage {
  const message = data as Partial<BrandingMessage> | null;
  return message?.type === BRANDING_MESSAGE && typeof message.active === 'boolean';
}

/** The sprite symbol Proton uses for the document icon in the shell header. */
const DOC_ICON_SYMBOL = 'mime-md-proton-doc';

function findInnerIcons(doc: Document): SVGElement[] {
  const icons = new Set<SVGElement>();
  doc.querySelectorAll('use').forEach((use) => {
    const ref = use.getAttribute('href') ?? use.getAttribute('xlink:href') ?? '';
    const svg = use.closest('svg');
    if (svg && ref.endsWith(`#${DOC_ICON_SYMBOL}`)) icons.add(svg);
  });
  return [...icons];
}

const ORIGINAL = 'data-pdt-original';

function setFavicon(doc: Document, href: string | null): void {
  const links = doc.querySelectorAll<HTMLLinkElement>('link[rel~="icon"]');
  if (href) {
    links.forEach((link) => {
      if (!link.hasAttribute(ORIGINAL)) link.setAttribute(ORIGINAL, link.href);
      link.href = href;
      link.removeAttribute('type');
    });
    if (links.length === 0) {
      const link = doc.createElement('link');
      link.rel = 'icon';
      link.href = href;
      link.setAttribute(ORIGINAL, '');
      doc.head.append(link);
    }
    return;
  }
  links.forEach((link) => {
    const original = link.getAttribute(ORIGINAL);
    if (original === null) return;
    if (original === '') link.remove();
    else link.href = original;
    link.removeAttribute(ORIGINAL);
  });
}

function setInnerIcons(doc: Document, href: string | null): void {
  // Painted icons no longer match the symbol, so undo walks the marked ones.
  const marked = [...doc.querySelectorAll<SVGElement>(`svg[${ORIGINAL}]`)];
  const targets = href ? findInnerIcons(doc) : marked;
  targets.forEach((svg) => {
    const uses = svg.querySelectorAll('use');
    if (href) {
      svg.setAttribute(ORIGINAL, '');
      svg.style.background = `center / contain no-repeat url("${href}")`;
      uses.forEach((use) => (use.style.display = 'none'));
    } else {
      svg.removeAttribute(ORIGINAL);
      svg.style.removeProperty('background');
      uses.forEach((use) => use.style.removeProperty('display'));
    }
  });
}

/** Apply (or undo) the board branding on the shell document. */
export function applyBranding(doc: Document, iconHref: string | null): void {
  setFavicon(doc, iconHref);
  setInnerIcons(doc, iconHref);
}
