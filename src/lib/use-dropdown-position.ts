import { useCallback, useLayoutEffect, useState } from "react";

interface DropdownPos {
  top: number;
  left: number;
  width: number;
  maxHeight: number;
}

const MAX_HEIGHT_CAP = 224; // 14rem ≈ Tailwind max-h-56
const GAP = 4;
const BOTTOM_PAD = 8;

/**
 * Returns fixed-position styles that keep a dropdown aligned below an anchor
 * element, respecting the visual viewport (i.e. the area not covered by the
 * mobile software keyboard). Returns `undefined` when `open` is false or the
 * anchor hasn't been measured yet.
 */
export function useDropdownPosition(
  anchorRef: React.RefObject<HTMLElement | null>,
  open: boolean,
): React.CSSProperties | undefined {
  const [pos, setPos] = useState<DropdownPos | null>(null);

  const measure = useCallback(() => {
    const el = anchorRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const vv = window.visualViewport;
    const vpHeight = vv ? vv.height : window.innerHeight;
    const vpOffsetTop = vv ? vv.offsetTop : 0;
    const top = rect.bottom + GAP;
    const available = vpHeight + vpOffsetTop - top - BOTTOM_PAD;
    setPos({
      top,
      left: rect.left,
      width: rect.width,
      maxHeight: Math.max(0, Math.min(available, MAX_HEIGHT_CAP)),
    });
  }, [anchorRef]);

  useLayoutEffect(() => {
    if (!open) return;
    measure();

    let raf = 0;
    const onUpdate = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(measure);
    };

    const vv = window.visualViewport;
    vv?.addEventListener("resize", onUpdate);
    vv?.addEventListener("scroll", onUpdate);
    window.addEventListener("resize", onUpdate);
    window.addEventListener("orientationchange", onUpdate);
    document.addEventListener("scroll", onUpdate, true);

    return () => {
      cancelAnimationFrame(raf);
      vv?.removeEventListener("resize", onUpdate);
      vv?.removeEventListener("scroll", onUpdate);
      window.removeEventListener("resize", onUpdate);
      window.removeEventListener("orientationchange", onUpdate);
      document.removeEventListener("scroll", onUpdate, true);
    };
  }, [open, measure]);

  if (!open || !pos) return undefined;

  return {
    position: "fixed",
    top: pos.top,
    left: pos.left,
    width: pos.width,
    maxHeight: pos.maxHeight,
    zIndex: 40,
  };
}
