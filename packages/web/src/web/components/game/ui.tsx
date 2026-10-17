import { itemIconUrl } from "../../game/assets";
import { itemDef } from "../../game/items";
import type { Stack } from "../../game/state";

export function Slot({
  stack,
  selected,
  onClick,
  onLongPress,
  size,
}: {
  stack: Stack;
  selected?: boolean;
  onClick?: () => void;
  onLongPress?: () => void;
  size?: number;
}) {
  let timer = 0;
  const start = () => {
    if (!onLongPress) return;
    timer = window.setTimeout(() => {
      timer = 0;
      onLongPress();
    }, 420);
  };
  const end = (fire: boolean) => {
    if (timer) {
      window.clearTimeout(timer);
      timer = 0;
      if (fire && onClick) onClick();
    }
  };
  return (
    <button
      type="button"
      className={`pb-slot${selected ? " pb-slot-sel" : ""}`}
      style={size ? { width: size, height: size, aspectRatio: "auto" } : undefined}
      onPointerDown={(e) => {
        e.preventDefault();
        if (onLongPress) start();
      }}
      onPointerUp={(e) => {
        e.preventDefault();
        if (onLongPress) end(true);
        else onClick?.();
      }}
      onPointerLeave={() => end(false)}
      onPointerCancel={() => end(false)}
    >
      {stack ? (
        <>
          <img src={itemIconUrl(stack.id)} alt={itemDef(stack.id).name} draggable={false} />
          {stack.n > 1 && <span className="pb-slot-n">{stack.n}</span>}
        </>
      ) : null}
    </button>
  );
}

export function Sheet({
  title,
  onClose,
  children,
  footer,
  wide,
  avoidBadge,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  wide?: boolean;
  /** leave room for the corner badge on narrow menu screens */
  avoidBadge?: boolean;
}) {
  return (
    <div
      className={`pb-fade${avoidBadge ? " pb-sheet-badge" : ""}`}
      style={{
        position: "absolute",
        inset: 0,
        background: "rgba(5,4,10,0.72)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "max(10px, env(safe-area-inset-top)) 10px max(10px, env(safe-area-inset-bottom))",
        zIndex: 40,
      }}
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="pb-panel"
        style={{
          width: "100%",
          maxWidth: wide ? 620 : 460,
          maxHeight: "100%",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "8px 10px",
            borderBottom: "2px solid var(--pb-stone)",
            flex: "0 0 auto",
          }}
        >
          <span className="pb-h">{title}</span>
          <button type="button" className="pb-btn" style={{ padding: "6px 11px" }} onClick={onClose}>
            X
          </button>
        </div>
        <div className="pb-scroll" style={{ padding: 10, flex: "1 1 auto", minHeight: 0 }}>
          {children}
        </div>
        {footer && (
          <div style={{ padding: 8, borderTop: "2px solid var(--pb-stone)", flex: "0 0 auto" }}>{footer}</div>
        )}
      </div>
    </div>
  );
}

export function Bar({
  value,
  max,
  color,
  height = 10,
  label,
}: {
  value: number;
  max: number;
  color: string;
  height?: number;
  label?: string;
}) {
  const f = Math.max(0, Math.min(1, max > 0 ? value / max : 0));
  return (
    <div
      style={{
        position: "relative",
        background: "#120f1c",
        border: "2px solid #2c2740",
        height,
        overflow: "hidden",
      }}
    >
      <div style={{ width: `${f * 100}%`, height: "100%", background: color }} />
      {label && (
        <span
          style={{
            position: "absolute",
            inset: 0,
            fontSize: 9,
            lineHeight: `${height - 4}px`,
            textAlign: "center",
            textShadow: "1px 1px 0 #000",
          }}
        >
          {label}
        </span>
      )}
    </div>
  );
}

export function Row({ children, gap = 6 }: { children: React.ReactNode; gap?: number }) {
  return <div style={{ display: "flex", gap, alignItems: "center" }}>{children}</div>;
}

export function SlotGrid({
  slots,
  cols,
  sel,
  onSlot,
  onLong,
}: {
  slots: Stack[];
  cols: number;
  sel?: number;
  onSlot: (i: number) => void;
  onLong?: (i: number) => void;
}) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: `repeat(${window.innerWidth < 520 ? Math.min(cols, 7) : cols}, 1fr)`, gap: 4 }}>
      {slots.map((s, i) => (
        <Slot
          key={i}
          stack={s}
          selected={sel === i}
          onClick={() => onSlot(i)}
          onLongPress={onLong ? () => onLong(i) : undefined}
        />
      ))}
    </div>
  );
}
