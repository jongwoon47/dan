import { useEffect, useRef } from "react";
import { useDanCopy } from "@/copy/useDanCopy";
import "./overflowMenu.css";

export type OverflowMenuItem = {
  label: string;
  onSelect: () => void;
  danger?: boolean;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: OverflowMenuItem[];
  label?: string;
};

export function OverflowMenu({
  open,
  onOpenChange,
  items,
  label,
}: Props) {
  const copy = useDanCopy();
  const resolvedLabel = label ?? copy.moreActions;
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    function onPointerDown(e: MouseEvent | TouchEvent) {
      const root = rootRef.current;
      if (!root) return;
      if (e.target instanceof Node && !root.contains(e.target)) {
        onOpenChange(false);
      }
    }

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onOpenChange(false);
      }
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onOpenChange]);

  return (
    <div className="overflow-menu" ref={rootRef}>
      <button
        type="button"
        className="overflow-menu__trigger"
        aria-label={resolvedLabel}
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => onOpenChange(!open)}
      >
        ⋯
      </button>
      {open ? (
        <div className="overflow-menu__panel" role="menu">
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              className={
                item.danger
                  ? "overflow-menu__item is-danger"
                  : "overflow-menu__item"
              }
              onClick={() => {
                onOpenChange(false);
                item.onSelect();
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
