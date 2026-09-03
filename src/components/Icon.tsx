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
  | 'checkmark-circle';

const ICONS: Record<IconName, ReactNode> = {
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
