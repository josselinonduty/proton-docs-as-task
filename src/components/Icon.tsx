import type { ReactNode, SVGProps } from 'react';

/**
 * A small, self-contained icon set drawn on Proton's 16×16 grid with
 * `fill="currentColor"`, mirroring the look of Proton's own `@proton/icons`
 * sprite. The extension lives inside a shadow root, so it cannot reference
 * Proton's page-level SVG sprite (`<use href="#ic-…">` does not cross the
 * shadow boundary); these inline paths keep the board visually consistent
 * with Proton Docs without any external dependency.
 */
export type IconName =
  | 'chevron-down'
  | 'chevron-right'
  | 'chevron-left'
  | 'cross'
  | 'plus'
  | 'dots-vertical'
  | 'dots'
  | 'checkmark'
  | 'arrow-up'
  | 'arrow-down'
  | 'exclamation-circle'
  | 'cog'
  | 'checkmark-circle'
  | 'flag'
  | 'calendar'
  | 'user'
  | 'tag'
  | 'note'
  | 'list'
  | 'pen'
  | 'trash'
  | 'squares'
  | 'code'
  | 'arrow-left'
  | 'magnifier'
  | 'filter'
  | 'arrows-up-down'
  | 'circle-half'
  | 'kanban'
  | 'palette'
  | 'link'
  | 'lock'
  | 'subtasks';

/** Outline icons drawn with a 1.4px stroke on the same 16×16 grid. */
function Stroke({ children }: { children: ReactNode }) {
  return (
    <g
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </g>
  );
}

const ICONS: Record<IconName, ReactNode> = {
  link: (
    <Stroke>
      <path d="M6.5 9.5a2.5 2.5 0 0 0 3.5 0l2.5-2.5a2.5 2.5 0 0 0-3.5-3.5L8 4.5M9.5 6.5a2.5 2.5 0 0 0-3.5 0L3.5 9a2.5 2.5 0 0 0 3.5 3.5l1-1" />
    </Stroke>
  ),
  lock: (
    <Stroke>
      <rect x="3.5" y="7" width="9" height="6.5" rx="1.5" />
      <path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" />
    </Stroke>
  ),
  flag: (
    <Stroke>
      <path d="M3.5 14V2.5M3.5 3h8.25l-1.75 3 1.75 3H3.5" />
    </Stroke>
  ),
  calendar: (
    <Stroke>
      <rect x="2.5" y="3.5" width="11" height="10" rx="2" />
      <path d="M2.5 6.5h11M5.5 2v3M10.5 2v3" />
    </Stroke>
  ),
  user: (
    <Stroke>
      <circle cx="8" cy="5.5" r="2.75" />
      <path d="M2.75 13.75c.6-2.4 2.75-4 5.25-4s4.65 1.6 5.25 4" />
    </Stroke>
  ),
  tag: (
    <Stroke>
      <path d="M2.5 2.5h5.1l6 6-5.1 5.1-6-6V2.5Z" />
      <circle cx="5.5" cy="5.5" r=".75" fill="currentColor" stroke="none" />
    </Stroke>
  ),
  note: (
    <Stroke>
      <path d="M4 1.75h5.5L12.5 4.75v9.5H4V1.75Z" />
      <path d="M6 8h4.5M6 10.75h3" />
    </Stroke>
  ),
  list: (
    <Stroke>
      <path d="M5.75 4h7.75M5.75 8h7.75M5.75 12h7.75" />
      <circle cx="2.75" cy="4" r=".6" fill="currentColor" />
      <circle cx="2.75" cy="8" r=".6" fill="currentColor" />
      <circle cx="2.75" cy="12" r=".6" fill="currentColor" />
    </Stroke>
  ),
  subtasks: (
    <Stroke>
      <path d="M3.5 2v8.75c0 .69.56 1.25 1.25 1.25H8.5M3.5 6.5h5" />
      <rect x="8.5" y="4.75" width="5" height="3.5" rx="1" />
      <rect x="8.5" y="10.25" width="5" height="3.5" rx="1" />
    </Stroke>
  ),
  pen: (
    <Stroke>
      <path d="M10.5 2.75 13.25 5.5 5.5 13.25H2.75V10.5L10.5 2.75Z" />
    </Stroke>
  ),
  trash: (
    <Stroke>
      <path d="M2.5 4.25h11M6.25 4.25V2.5h3.5v1.75M3.75 4.25l.7 9.25h7.1l.7-9.25" />
    </Stroke>
  ),
  kanban: (
    <Stroke>
      <rect x="2.25" y="2.25" width="11.5" height="11.5" rx="2" />
      <path d="M6 5v4.5M10 5v2.5" />
    </Stroke>
  ),
  squares: (
    <Stroke>
      <rect x="5.25" y="5.25" width="8.25" height="8.25" rx="1.5" />
      <path d="M10.75 5.25V3.5c0-.55-.45-1-1-1H3.5c-.55 0-1 .45-1 1v6.25c0 .55.45 1 1 1h1.75" />
    </Stroke>
  ),
  code: (
    <Stroke>
      <path d="m5.5 4.5-3.5 3.5 3.5 3.5M10.5 4.5l3.5 3.5-3.5 3.5" />
    </Stroke>
  ),
  'arrow-left': (
    <Stroke>
      <path d="M13 8H3.25M7 4 3 8l4 4" />
    </Stroke>
  ),
  magnifier: (
    <Stroke>
      <circle cx="7" cy="7" r="4.5" />
      <path d="m10.5 10.5 3 3" />
    </Stroke>
  ),
  filter: (
    <Stroke>
      <path d="M2.5 3.5h11M4.75 8h6.5M7 12.5h2" />
    </Stroke>
  ),
  'arrows-up-down': (
    <Stroke>
      <path d="M5 13V3M2.5 5.5 5 3l2.5 2.5M11 3v10M8.5 10.5 11 13l2.5-2.5" />
    </Stroke>
  ),
  'circle-half': (
    <>
      <path d="M8 1.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13ZM3.5 8a4.5 4.5 0 1 1 9 0 4.5 4.5 0 0 1-9 0Z" />
      <path d="M8 4.5a3.5 3.5 0 0 1 0 7v-7Z" />
    </>
  ),
  'chevron-down': (
    <path d="M4.293 6.293a1 1 0 0 1 1.414 0L8 8.586l2.293-2.293a1 1 0 1 1 1.414 1.414l-3 3a1 1 0 0 1-1.414 0l-3-3a1 1 0 0 1 0-1.414Z" />
  ),
  'chevron-right': (
    <path d="M6.293 4.293a1 1 0 0 1 1.414 0l3 3a1 1 0 0 1 0 1.414l-3 3a1 1 0 0 1-1.414-1.414L8.586 8 6.293 5.707a1 1 0 0 1 0-1.414Z" />
  ),
  'chevron-left': (
    <path d="M9.707 4.293a1 1 0 0 1 0 1.414L7.414 8l2.293 2.293a1 1 0 0 1-1.414 1.414l-3-3a1 1 0 0 1 0-1.414l3-3a1 1 0 0 1 1.414 0Z" />
  ),
  cross: (
    <path d="M4.293 4.293a1 1 0 0 1 1.414 0L8 6.586l2.293-2.293a1 1 0 1 1 1.414 1.414L9.414 8l2.293 2.293a1 1 0 0 1-1.414 1.414L8 9.414l-2.293 2.293a1 1 0 0 1-1.414-1.414L6.586 8 4.293 5.707a1 1 0 0 1 0-1.414Z" />
  ),
  plus: (
    <path d="M8 3a1 1 0 0 1 1 1v3h3a1 1 0 1 1 0 2H9v3a1 1 0 1 1-2 0V9H4a1 1 0 0 1 0-2h3V4a1 1 0 0 1 1-1Z" />
  ),
  'dots-vertical': (
    <>
      <circle cx="8" cy="3.2" r="1.3" />
      <circle cx="8" cy="8" r="1.3" />
      <circle cx="8" cy="12.8" r="1.3" />
    </>
  ),
  dots: (
    <>
      <circle cx="3.2" cy="8" r="1.3" />
      <circle cx="8" cy="8" r="1.3" />
      <circle cx="12.8" cy="8" r="1.3" />
    </>
  ),
  checkmark: (
    <path d="M13.207 4.293a1 1 0 0 1 0 1.414l-6 6a1 1 0 0 1-1.414 0l-3-3a1 1 0 1 1 1.414-1.414L6.5 9.586l5.293-5.293a1 1 0 0 1 1.414 0Z" />
  ),
  'arrow-up': (
    <path d="M8 3a1 1 0 0 1 .707.293l4 4a1 1 0 0 1-1.414 1.414L9 6.414V12a1 1 0 1 1-2 0V6.414L4.707 8.707a1 1 0 0 1-1.414-1.414l4-4A1 1 0 0 1 8 3Z" />
  ),
  'arrow-down': (
    <path d="M8 13a1 1 0 0 1-.707-.293l-4-4a1 1 0 1 1 1.414-1.414L7 9.586V4a1 1 0 1 1 2 0v5.586l2.293-2.293a1 1 0 0 1 1.414 1.414l-4 4A1 1 0 0 1 8 13Z" />
  ),
  'exclamation-circle': (
    <>
      <path d="M8 1.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13ZM3.5 8a4.5 4.5 0 1 1 9 0 4.5 4.5 0 0 1-9 0Z" />
      <path d="M8 4.25a.85.85 0 0 0-.85.85v3a.85.85 0 0 0 1.7 0v-3A.85.85 0 0 0 8 4.25Zm0 5.4a.95.95 0 1 0 0 1.9.95.95 0 0 0 0-1.9Z" />
    </>
  ),
  'checkmark-circle': (
    <>
      <path d="M8 1.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13ZM3.5 8a4.5 4.5 0 1 1 9 0 4.5 4.5 0 0 1-9 0Z" />
      <path d="M11.03 5.97a.75.75 0 0 1 0 1.06l-3.5 3.5a.75.75 0 0 1-1.06 0l-1.5-1.5a.75.75 0 1 1 1.06-1.06L7 8.94l2.97-2.97a.75.75 0 0 1 1.06 0Z" />
    </>
  ),
  palette: (
    <>
      <path d="M8 1.5a6.5 6.5 0 0 0 0 13c.97 0 1.6-.8 1.6-1.65 0-.42-.15-.77-.37-1.05a.9.9 0 0 1 .7-1.45h1.27A3.3 3.3 0 0 0 14.5 7c0-3.04-2.9-5.5-6.5-5.5ZM3.5 8A4.5 4.5 0 0 1 8 3.5c2.6 0 4.5 1.67 4.5 3.5 0 .7-.58 1.3-1.3 1.3H9.93a2.9 2.9 0 0 0-2.27 4.66A4.5 4.5 0 0 1 3.5 8Z" />
      <circle cx="5.5" cy="8.25" r="1" />
      <circle cx="6.75" cy="5.5" r="1" />
      <circle cx="9.75" cy="5.5" r="1" />
    </>
  ),
  cog: (
    <path d="M6.94 1.5a1 1 0 0 0-.98.804l-.22 1.1c-.36.15-.7.35-1.02.59l-1.06-.37a1 1 0 0 0-1.2.45L1.34 5.91a1 1 0 0 0 .22 1.27l.84.72a4.94 4.94 0 0 0 0 1.18l-.84.72a1 1 0 0 0-.22 1.27l1.12 1.94a1 1 0 0 0 1.2.45l1.06-.37c.32.24.66.44 1.02.59l.22 1.1a1 1 0 0 0 .98.804h2.12a1 1 0 0 0 .98-.804l.22-1.1c.36-.15.7-.35 1.02-.59l1.06.37a1 1 0 0 0 1.2-.45l1.12-1.94a1 1 0 0 0-.22-1.27l-.84-.72a4.94 4.94 0 0 0 0-1.18l.84-.72a1 1 0 0 0 .22-1.27l-1.12-1.94a1 1 0 0 0-1.2-.45l-1.06.37a4.9 4.9 0 0 0-1.02-.59l-.22-1.1a1 1 0 0 0-.98-.804H6.94ZM8 6a2 2 0 1 1 0 4 2 2 0 0 1 0-4Z" />
  ),
};

interface IconProps extends Omit<SVGProps<SVGSVGElement>, 'name'> {
  name: IconName;
  size?: number;
}

/** Render a Proton-style icon. Inherits color from the surrounding text. */
export function Icon({ name, size = 16, className, ...rest }: IconProps) {
  return (
    <svg
      className={`pdt-icon${className ? ` ${className}` : ''}`}
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {ICONS[name]}
    </svg>
  );
}
