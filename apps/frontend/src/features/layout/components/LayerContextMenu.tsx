import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

export interface MenuItem {
  label: string;
  disabled?: boolean;
  onSelect: () => void;
}

interface LayerContextMenuProps {
  anchor: { x: number; y: number };
  items: Array<
    | MenuItem
    | {
        label: string;
        children: MenuItem[];
      }
  >;
  onClose: () => void;
}

export function LayerContextMenu({ anchor, items, onClose }: LayerContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [openSubmenu, setOpenSubmenu] = useState<number | null>(null);
  const [position, setPosition] = useState({ x: anchor.x, y: anchor.y });

  useLayoutEffect(() => {
    const menu = menuRef.current;
    if (!menu) {
      return;
    }
    const rect = menu.getBoundingClientRect();
    setPosition({
      x: Math.min(anchor.x, window.innerWidth - rect.width - 8),
      y: Math.min(anchor.y, window.innerHeight - rect.height - 8),
    });
  }, [anchor]);

  useEffect(() => {
    const enabledItems = Array.from(
      menuRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not(:disabled)') ??
        [],
    );
    enabledItems[0]?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        onClose();
        return;
      }
      if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
        return;
      }
      const activeItems = Array.from(
        menuRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not(:disabled)') ??
          [],
      );
      if (activeItems.length === 0) {
        return;
      }
      event.preventDefault();
      const currentIndex = activeItems.indexOf(document.activeElement as HTMLButtonElement);
      const nextIndex =
        event.key === 'Home'
          ? 0
          : event.key === 'End'
            ? activeItems.length - 1
            : event.key === 'ArrowDown'
              ? (currentIndex + 1 + activeItems.length) % activeItems.length
              : (currentIndex - 1 + activeItems.length) % activeItems.length;
      activeItems[nextIndex]?.focus();
    };
    const onPointerDown = (event: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown, true);
    window.addEventListener('pointerdown', onPointerDown, true);
    window.addEventListener('scroll', onClose, true);
    return () => {
      window.removeEventListener('keydown', onKeyDown, true);
      window.removeEventListener('pointerdown', onPointerDown, true);
      window.removeEventListener('scroll', onClose, true);
    };
  }, [onClose]);

  return createPortal(
    <div
      ref={menuRef}
      role="menu"
      aria-label="계층 작업"
      className="fixed z-50 min-w-[180px] rounded-md border border-panel-divider bg-white py-1 shadow-raised"
      style={{ left: position.x, top: position.y }}
    >
      {items.map((item, index) => {
        if ('children' in item) {
          return (
            <div key={item.label} className="relative" onMouseEnter={() => setOpenSubmenu(index)}>
              <button
                type="button"
                role="menuitem"
                aria-haspopup="menu"
                aria-expanded={openSubmenu === index}
                onClick={() => setOpenSubmenu((current) => (current === index ? null : index))}
                className="flex w-full items-center justify-between px-3 py-1.5 text-left text-xs text-text-strong hover:bg-panel-soft focus-visible:bg-panel-soft focus-visible:outline-none"
              >
                <span>{item.label}</span>
                <span aria-hidden>▸</span>
              </button>
              {openSubmenu === index && (
                <div
                  role="menu"
                  aria-label={item.label}
                  className="absolute left-full top-0 min-w-[160px] rounded-md border border-panel-divider bg-white py-1 shadow-raised"
                >
                  {item.children.map((child) => (
                    <button
                      key={child.label}
                      type="button"
                      role="menuitem"
                      disabled={child.disabled}
                      onClick={() => {
                        child.onSelect();
                        onClose();
                      }}
                      className="block w-full px-3 py-1.5 text-left text-xs text-text-strong enabled:hover:bg-panel-soft disabled:text-text-muted/60 focus-visible:bg-panel-soft focus-visible:outline-none"
                    >
                      {child.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        }
        return (
          <button
            key={item.label}
            type="button"
            role="menuitem"
            disabled={item.disabled}
            onClick={() => {
              item.onSelect();
              onClose();
            }}
            className="block w-full px-3 py-1.5 text-left text-xs text-text-strong enabled:hover:bg-panel-soft disabled:text-text-muted/60 focus-visible:bg-panel-soft focus-visible:outline-none"
          >
            {item.label}
          </button>
        );
      })}
    </div>,
    document.body,
  );
}
