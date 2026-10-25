import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { modLabel } from '@/lib/platform';
import { Icon } from '@/components/Icon';
import { useMenuButton } from '@/components/useMenuButton';

interface BoardMenuProps {
  selectionMode: boolean;
  onToggleSelection: () => void;
  onBoardSettings: () => void;
  onCopyBoard: () => Promise<void>;
  onReload: () => void;
  onPalette: () => void;
  onHelp: () => void;
  onExtensionSettings: () => void;
}

/**
 * The header's "More actions" menu (the menu button pattern, see
 * `useMenuButton`). Each item closes it and returns focus to the button.
 */
export function BoardMenu(props: BoardMenuProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const { wrapRef, triggerRef, menuRef, triggerProps, menuProps, close } = useMenuButton(
    open,
    setOpen,
  );
  const mod = modLabel();

  /** Close the menu, then run `action`. */
  const item = (action: () => void) => () => {
    close();
    action();
  };

  return (
    <div className="pdt-menu" ref={wrapRef}>
      <button
        type="button"
        className="pdt-btn pdt-btn-icon"
        aria-label={t('board.more')}
        title={t('board.more')}
        ref={triggerRef}
        {...triggerProps}
      >
        <Icon name="dots-vertical" />
      </button>
      {open && (
        <div className="pdt-menu__panel" ref={menuRef} {...menuProps}>
          <MenuItem
            label={props.selectionMode ? t('board.menu.exitSelection') : t('board.menu.select')}
            hint={`${mod} A`}
            onClick={item(props.onToggleSelection)}
          />
          <MenuItem label={t('settings.title')} onClick={item(props.onBoardSettings)} />
          <MenuItem
            label={t('board.menu.copyBoard')}
            onClick={item(() => void props.onCopyBoard())}
          />
          <MenuItem label={t('board.menu.reload')} onClick={item(props.onReload)} />
          <div className="pdt-menu__sep" role="separator" />
          <MenuItem label={t('palette.title')} hint={`${mod} K`} onClick={item(props.onPalette)} />
          <MenuItem label={t('shortcuts.title')} hint="?" onClick={item(props.onHelp)} />
          <MenuItem label={t('board.menu.extension')} onClick={item(props.onExtensionSettings)} />
        </div>
      )}
    </div>
  );
}

function MenuItem({ label, hint, onClick }: { label: string; hint?: string; onClick: () => void }) {
  return (
    <button
      type="button"
      role="menuitem"
      tabIndex={-1}
      className="pdt-menu__item"
      onClick={onClick}
    >
      <span>{label}</span>
      {hint && <kbd className="pdt-menu__hint">{hint}</kbd>}
    </button>
  );
}
