import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

interface SectionNameInputProps {
  name: string;
  /** Names of the other sections, to reject a rename that would merge two. */
  otherNames: string[];
  /** What is being named, for messages and labels (default `section`). */
  noun?: 'section' | 'status';
  /** Compare names case-insensitively when rejecting duplicates. */
  ignoreCase?: boolean;
  /** Grab focus once (e.g. after a rename re-keyed the column). */
  autoFocus?: boolean;
  onFocusHandled?: () => void;
  /** Commit a validated new name. `viaKeyboard` is true when Enter committed it. */
  onRename: (next: string, viaKeyboard: boolean) => void;
  onInvalid: (message: string) => void;
}

/**
 * Inline editor for a section heading (or another column name, via `noun`). Edits are kept as a local draft and
 * written once — on Enter or blur — instead of on every keystroke: renaming a
 * section rewrites a document heading and re-keys its column, so per-keystroke
 * writes would churn the document and drop focus mid-word. Escape reverts.
 */
export function SectionNameInput({
  name,
  otherNames,
  noun = 'section',
  ignoreCase = false,
  autoFocus,
  onFocusHandled,
  onRename,
  onInvalid,
}: SectionNameInputProps) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState(name);
  const [editing, setEditing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const viaKeyboard = useRef(false);

  // Follow renames made elsewhere (document edits) while not editing.
  useEffect(() => {
    if (!editing) setDraft(name);
  }, [name, editing]);

  useEffect(() => {
    if (!autoFocus) return;
    inputRef.current?.focus();
    onFocusHandled?.();
  }, [autoFocus, onFocusHandled]);

  const clean = draft.trim();
  const same = (a: string) => (ignoreCase ? a.toLowerCase() === clean.toLowerCase() : a === clean);
  const duplicate = clean !== name && otherNames.some(same);
  const error = !clean
    ? t('name.required', { context: noun })
    : duplicate
      ? t('name.exists', { name: clean })
      : '';

  const commit = () => {
    setEditing(false);
    if (clean === name) {
      setDraft(name);
      return;
    }
    if (error) {
      onInvalid(t('name.kept', { error, name }));
      setDraft(name);
      return;
    }
    onRename(clean, viaKeyboard.current);
  };

  return (
    <input
      ref={inputRef}
      className="pdt-column__name-input"
      value={draft}
      aria-label={t('name.label', { context: noun, name })}
      aria-invalid={error ? true : undefined}
      title={error || t('name.rename', { context: noun })}
      onFocus={() => {
        viaKeyboard.current = false;
        setEditing(true);
      }}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          viaKeyboard.current = true;
          inputRef.current?.blur();
        } else if (e.key === 'Escape') {
          e.preventDefault();
          e.stopPropagation();
          setDraft(name);
          setEditing(false);
          // Revert first so the blur that follows commits nothing.
          requestAnimationFrame(() => inputRef.current?.blur());
        }
      }}
    />
  );
}
