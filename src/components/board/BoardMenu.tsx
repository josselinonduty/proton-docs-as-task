import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { modLabel } from '../../lib/platform';
import { Icon } from '../Icon';
import { useDismiss } from '../useDismiss';

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

/** The header's "More actions" menu. Each item closes it. */
export function BoardMenu(props: BoardMenuProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  useDismiss(open, [menuRef], () => setOpen(false), { escape: true });
  const mod = modLabel();

  /** Run `action` from an item, then close the menu. */
  const item = (action: () => void) => () => {
    action();
    setOpen(false);
  };

  return (
    <div className="pdt-menu" ref={menuRef}>
      <button
        type="button"
        className="pdt-btn pdt-btn-icon"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={t('board.more')}
        title={t('board.more')}
        onClick={() => setOpen((v) => !v)}
      >
        <Icon name="dots-vertical" />
      </button>
      {open && (
        <div className="pdt-menu__panel" role="menu">
          <MenuItem
            label={props.selectionMode ? t('board.menu.exitSelection') : t('board.menu.select')}
            hint={`${mod} A`}
            onClick={item(props.onToggleSelection)}
          />
          <MenuItem label={t('settings.title')} onClick={item(props.onBoardSettings)} />
          <MenuItem
            label={t('board.menu.copyBoard')}
            onClick={async () => {
              await props.onCopyBoard();
              setOpen(false);
            }}
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
    <button type="button" role="menuitem" className="pdt-menu__item" onClick={onClick}>
      <span>{label}</span>
      {hint && <kbd className="pdt-menu__hint">{hint}</kbd>}
    </button>
  );
}
