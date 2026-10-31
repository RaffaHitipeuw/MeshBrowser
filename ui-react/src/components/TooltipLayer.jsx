// Tooltips.
//
// Port of ui/js/lib/tooltip.js. The legacy module bound a listener to every
// element that carried a data-tooltip attribute at boot; React renders those
// elements later, so the layer uses event delegation on the document
// instead. The rendered node keeps the legacy markup and class names
// (.mesh-tooltip, .is-top/.is-bottom, .is-visible) so the CSS is unchanged.

import { useCallback, useEffect, useRef, useState } from "react";

const GAP = 8;

export default function TooltipLayer() {
  const [tip, setTip] = useState({ visible: false, text: "", left: 0, top: 0, placement: "top" });
  const activeRef = useRef(null);
  const timerRef = useRef(0);

  const hide = useCallback(() => {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
      timerRef.current = 0;
    }
    activeRef.current = null;
    setTip((current) => (current.visible ? { ...current, visible: false } : current));
  }, []);

  const show = useCallback((el) => {
    if (!el) return;
    const text = el.getAttribute("data-tooltip");
    if (!text) {
      hide();
      return;
    }
    const rect = el.getBoundingClientRect();
    const placement = el.getAttribute("data-tooltip-placement") || "top";
    const left = rect.left + rect.width / 2;
    const top = placement === "bottom" ? rect.bottom + GAP : rect.top - GAP;
    activeRef.current = el;
    setTip({ visible: true, text, left, top, placement });
  }, [hide]);

  useEffect(() => {
    const onPointerOver = (event) => {
      const el = event.target instanceof Element ? event.target.closest("[data-tooltip]") : null;
      if (!el) {
        if (activeRef.current && !activeRef.current.contains(event.target)) {
          hide();
        }
        return;
      }
      if (activeRef.current === el) return;
      show(el);
    };
    const onFocusIn = (event) => {
      const el = event.target instanceof Element ? event.target.closest("[data-tooltip]") : null;
      if (el) show(el);
    };
    const onFocusOut = () => hide();
    const onPointerDown = () => hide();
    const onKeyDown = (event) => {
      if (event.key === "Escape") hide();
    };
    document.addEventListener("pointerover", onPointerOver, true);
    document.addEventListener("focusin", onFocusIn, true);
    document.addEventListener("focusout", onFocusOut, true);
    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("keydown", onKeyDown, true);
    window.addEventListener("scroll", hide, true);
    window.addEventListener("resize", hide);
    return () => {
      document.removeEventListener("pointerover", onPointerOver, true);
      document.removeEventListener("focusin", onFocusIn, true);
      document.removeEventListener("focusout", onFocusOut, true);
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("keydown", onKeyDown, true);
      window.removeEventListener("scroll", hide, true);
      window.removeEventListener("resize", hide);
    };
  }, [hide, show]);

  return (
    <div
      className={`mesh-tooltip ${tip.placement === "bottom" ? "is-bottom" : "is-top"} ${
        tip.visible ? "is-visible" : ""
      }`}
      role="tooltip"
      hidden={!tip.visible}
      style={{ left: `${tip.left}px`, top: `${tip.top}px` }}
    >
      {tip.text}
    </div>
  );
}
