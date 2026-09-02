/**
 * Reads the Proton Docs (Lexical) editor DOM and serializes it into a plain
 * text representation that `parseDocument` understands.
 *
 * Proton Docs renders its content inside a sandboxed Lexical editor iframe
 * (docs-editor.proton.me). Lexical emits real DOM nodes — headings as
 * `<h1..6>`, lists as `<ul>/<ol>` with `<li>`, check lists as `<li>` carrying
 * `role="checkbox"` + `aria-checked` — so we can walk that tree deterministically
 * rather than depending on Proton's (changeable) CSS class names.
 */

const EDITOR_SELECTORS = [
  '[data-lexical-editor="true"]',
  '[contenteditable="true"][role="textbox"]',
  '.ProseMirror[contenteditable="true"]',
  '[contenteditable="true"]',
];

/** Locate the editable document root, if present in this frame. */
export function findEditorRoot(doc: Document = document): HTMLElement | null {
  for (const selector of EDITOR_SELECTORS) {
    const candidates = Array.from(
      doc.querySelectorAll<HTMLElement>(selector),
    ).filter((el) => el.isContentEditable || el.getAttribute('contenteditable') === 'true');
    if (candidates.length === 0) continue;
    // Prefer the largest visible editable region.
    candidates.sort((a, b) => area(b) - area(a));
    const best = candidates[0];
    if (best && area(best) > 0) return best;
  }
  return null;
}

function area(el: HTMLElement): number {
  const r = el.getBoundingClientRect();
  return r.width * r.height;
}

function isCheckListItem(li: Element): boolean {
  return (
    li.getAttribute('role') === 'checkbox' ||
    li.hasAttribute('aria-checked') ||
    /check/i.test(li.className)
  );
}

function isChecked(li: Element): boolean {
  const aria = li.getAttribute('aria-checked');
  if (aria != null) return aria === 'true';
  // Fall back to class names — test "unchecked" first (it contains "checked").
  const cls = li.className || '';
  if (/unchecked/i.test(cls)) return false;
  return /checked/i.test(cls);
}

/** Text of an element excluding any nested list content. */
function ownText(el: Element): string {
  let out = '';
  el.childNodes.forEach((node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      out += node.textContent ?? '';
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const tag = (node as Element).tagName.toLowerCase();
      if (tag === 'ul' || tag === 'ol') return; // handled separately
      out += (node as Element).textContent ?? '';
    }
  });
  return out.replace(/\s+/g, ' ').trim();
}

function serializeListItem(li: Element, lines: string[]): void {
  const text = ownText(li);
  if (text !== '') {
    if (isCheckListItem(li)) {
      lines.push(`- [${isChecked(li) ? 'x' : ' '}] ${text}`);
    } else {
      lines.push(`- ${text}`);
    }
  }
  // Recurse into nested lists (subtasks are flattened).
  li.querySelectorAll(':scope > ul, :scope > ol').forEach((sub) => {
    serializeList(sub, lines);
  });
}

function serializeList(list: Element, lines: string[]): void {
  Array.from(list.children).forEach((child) => {
    if (child.tagName.toLowerCase() === 'li') serializeListItem(child, lines);
  });
}

function serializeBlock(el: Element, lines: string[]): void {
  const tag = el.tagName.toLowerCase();

  if (/^h[1-6]$/.test(tag)) {
    const level = Number(tag[1]);
    const text = el.textContent?.replace(/\s+/g, ' ').trim() ?? '';
    if (text !== '') lines.push(`${'#'.repeat(level)} ${text}`);
    return;
  }

  if (tag === 'ul' || tag === 'ol') {
    serializeList(el, lines);
    return;
  }

  // Paragraphs, divs, blockquotes, etc. — emit their flattened text as a line.
  // Skip containers that only wrap block children (avoids duplicate output).
  const hasBlockChildren = Array.from(el.children).some((c) =>
    /^(h[1-6]|ul|ol|p|div|blockquote|table)$/.test(c.tagName.toLowerCase()),
  );
  if (hasBlockChildren) {
    Array.from(el.children).forEach((child) => serializeBlock(child, lines));
    return;
  }

  const text = el.textContent?.replace(/\s+/g, ' ').trim() ?? '';
  lines.push(text);
}

/** Serialize the editor root into marker/heading/checkbox text lines. */
export function extractText(root: HTMLElement): string {
  const lines: string[] = [];
  Array.from(root.children).forEach((child) => serializeBlock(child, lines));
  return lines.join('\n');
}

export interface EditorWatcher {
  stop: () => void;
}

/**
 * Observe an editor root for content changes and invoke `onChange` (debounced)
 * with the freshly extracted text. Also fires once immediately.
 */
export function watchEditor(
  root: HTMLElement,
  onChange: (text: string) => void,
  debounceMs = 250,
): EditorWatcher {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const emit = () => onChange(extractText(root));

  const schedule = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(emit, debounceMs);
  };

  const observer = new MutationObserver(schedule);
  observer.observe(root, {
    childList: true,
    subtree: true,
    characterData: true,
    attributes: true,
    attributeFilter: ['aria-checked', 'class'],
  });

  emit();

  return {
    stop() {
      if (timer) clearTimeout(timer);
      observer.disconnect();
    },
  };
}
