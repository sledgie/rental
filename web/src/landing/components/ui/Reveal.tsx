import { createElement, useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { cn } from "@lf/utils/cn";

/**
 * Subtle scroll-triggered entrance. Uses one shared IntersectionObserver and
 * is fully disabled by `prefers-reduced-motion` (see `.reveal` in index.css).
 */

type RevealTag = "div" | "li" | "article" | "figure" | "header";

let sharedObserver: IntersectionObserver | null = null;
const callbacks = new WeakMap<Element, () => void>();

function observe(element: Element, onVisible: () => void) {
  if (typeof window === "undefined" || !("IntersectionObserver" in window)) {
    onVisible();
    return () => undefined;
  }

  if (!sharedObserver) {
    sharedObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          callbacks.get(entry.target)?.();
          callbacks.delete(entry.target);
          sharedObserver?.unobserve(entry.target);
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0 },
    );
  }

  callbacks.set(element, onVisible);
  sharedObserver.observe(element);

  return () => {
    callbacks.delete(element);
    sharedObserver?.unobserve(element);
  };
}

interface RevealProps {
  as?: RevealTag;
  /** Stagger delay in milliseconds. */
  delay?: number;
  className?: string;
  id?: string;
  children: ReactNode;
}

export function Reveal({ as = "div", delay = 0, className, id, children }: RevealProps) {
  const ref = useRef<HTMLElement | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    return observe(element, () => setVisible(true));
  }, []);

  const style = delay ? ({ "--reveal-delay": `${delay}ms` } as CSSProperties) : undefined;

  return createElement(
    as,
    { ref, id, style, className: cn("reveal", visible && "is-visible", className) },
    children,
  );
}
