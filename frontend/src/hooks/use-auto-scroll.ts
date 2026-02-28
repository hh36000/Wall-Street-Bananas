import React from "react";

type AutoScrollOptions = {
  signature: string | number;
  isMobile?: boolean;
  thresholdDesktop?: number; // px
  thresholdMobile?: number; // px
};

export function useAutoScroll({
  signature,
  isMobile,
  thresholdDesktop = 40,
  thresholdMobile = 100,
}: AutoScrollOptions) {
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const userScrolledAwayRef = React.useRef(false);
  const [userScrolledAway, setUserScrolledAway] = React.useState(false);
  const [showNewMessageIndicator, setShowNewMessageIndicator] = React.useState(false);
  const lastSignatureRef = React.useRef<string | number | null>(null);
  const lastScrollTopRef = React.useRef(0);
  const rafRef = React.useRef<number | null>(null);

  const getThreshold = () => (isMobile ? thresholdMobile : thresholdDesktop);

  // Initialization complete

  const isNearBottom = React.useCallback(() => {
    const el = containerRef.current;
    if (!el) return true;
    const { scrollTop, scrollHeight, clientHeight } = el;
    const distance = scrollHeight - scrollTop - clientHeight;
    return distance <= getThreshold();
  }, [isMobile, thresholdDesktop, thresholdMobile]);

  const scrollToBottom = React.useCallback((smooth = true) => {
    const el = containerRef.current;
    if (!el) return;
    const run = () => {
      try {
        el.scrollTo({ top: el.scrollHeight, behavior: smooth ? "smooth" : "auto" });
      } catch {
        el.scrollTop = el.scrollHeight;
      }
      userScrolledAwayRef.current = false;
      setUserScrolledAway(false);
      setShowNewMessageIndicator(false);
    };
    if (typeof window !== "undefined" && "requestAnimationFrame" in window) {
      requestAnimationFrame(run);
    } else {
      run();
    }
  }, []);

  const handleScroll = React.useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const currentTop = el.scrollTop;
    const wasTop = lastScrollTopRef.current;
    const nearBottom = isNearBottom();

    if (currentTop < wasTop && !nearBottom) {
      userScrolledAwayRef.current = true;
      if (!userScrolledAway) setUserScrolledAway(true);
    }
    // Close enough to bottom -> consider user back at bottom
    if (nearBottom) {
      userScrolledAwayRef.current = false;
      if (userScrolledAway) setUserScrolledAway(false);
      if (showNewMessageIndicator) setShowNewMessageIndicator(false);
    }

    lastScrollTopRef.current = currentTop;
  }, [isNearBottom, userScrolledAway, showNewMessageIndicator]);

  const onScroll = React.useCallback(() => {
    if (rafRef.current != null) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      handleScroll();
    });
  }, [handleScroll]);

  // Effect: new content detection via signature changes
  React.useEffect(() => {
    const prev = lastSignatureRef.current;
    const next = signature;
    lastSignatureRef.current = next;

    const attempt = () => {
      const el = containerRef.current;
      if (!el) {
        return false;
      }

      const nearBottom = isNearBottom();

      const parseSig = (sig: string | number | null) => {
        if (sig == null) return { count: 0, len: 0, flag: 0, thinking: 0 };
        if (typeof sig === "number") return { count: sig, len: 0, flag: 0, thinking: 0 };
        const [a, b, c, d] = String(sig).split(":");
        return {
          count: parseInt(a || "0", 10) || 0,
          len: parseInt(b || "0", 10) || 0,
          flag: parseInt(c || "0", 10) || 0,
          thinking: parseInt(d || "0", 10) || 0,
        };
      };

      const { count: pc, len: pl, flag: pf, thinking: pt } = parseSig(prev);
      const { count: nc, len: nl, flag: nf, thinking: nt } = parseSig(next);

      const gotNewContent = nc > pc || nl > pl || nf > pf || nt > pt;

      if (gotNewContent) {
        if (!userScrolledAwayRef.current || nearBottom) {
          // Auto-scroll only if user hasn't scrolled away or is near bottom
          scrollToBottom(true);
        } else {
          // Show an indicator so user can jump to latest
          setShowNewMessageIndicator(true);
        }
      }
      return true;
    };

    // Try now; if container not ready, retry next frame
    if (!attempt()) {
      if (typeof window !== "undefined" && "requestAnimationFrame" in window) {
        requestAnimationFrame(() => {
          attempt();
          // Try again after a small delay to catch height animations
          setTimeout(() => attempt(), 120);
        });
      }
    }
  }, [signature, isNearBottom, scrollToBottom]);

  // Apply mobile-friendly scroll behavior styles
  React.useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.style.overscrollBehavior = "contain";
    // @ts-ignore - vendor property
    (el.style as any).webkitOverflowScrolling = "touch";
  }, []);

  React.useEffect(() => () => {
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
  }, []);

  return {
    containerRef,
    onScroll,
    scrollToBottom,
    userScrolledAway,
    showNewMessageIndicator,
    isNearBottom,
  } as const;
}
