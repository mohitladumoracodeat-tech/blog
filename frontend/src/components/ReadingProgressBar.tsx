import { useEffect, useRef } from "react";

export interface ReadingProgressBarProps {
  targetRef: React.RefObject<HTMLElement | null>;
  scrollContainerRef?: React.RefObject<HTMLElement | null>;
  className?: string;
}

/**
 * ReadingProgressBar
 *
 * Polished, high-performance reading progress indicator strictly measuring
 * the story content area. Updates DOM directly via requestAnimationFrame
 * to eliminate React re-renders on scroll.
 */
export function ReadingProgressBar({ targetRef, scrollContainerRef, className = "" }: ReadingProgressBarProps) {
  const barRef = useRef<HTMLDivElement>(null);
  const rafId = useRef<number | null>(null);

  useEffect(() => {
    function updateProgress() {
      if (!targetRef.current || !barRef.current) return;

      let progress = 0;
      const container = scrollContainerRef?.current;

      if (container) {
        const containerRect = container.getBoundingClientRect();
        const targetRect = targetRef.current.getBoundingClientRect();
        const contentTop = targetRect.top - containerRect.top;
        const contentHeight = targetRect.height;
        const viewportHeight = container.clientHeight;
        const headerOffset = 64;

        if (contentTop > headerOffset) {
          progress = 0;
        } else {
          const scrollDistance = contentHeight - (viewportHeight - headerOffset);
          if (scrollDistance <= 0) {
            progress = 100;
          } else {
            const currentScroll = -(contentTop - headerOffset);
            progress = Math.min(100, Math.max(0, (currentScroll / scrollDistance) * 100));
          }
        }
      } else {
        const rect = targetRef.current.getBoundingClientRect();
        const windowHeight = window.innerHeight;
        const headerOffset = 80; // approximate sticky header height
        const contentTop = rect.top - headerOffset;
        const contentHeight = rect.height;

        if (contentTop > 0) {
          // Reader has not yet scrolled into the article content
          progress = 0;
        } else {
          // Distance from start of content to when bottom of content reaches bottom of viewport
          const scrollDistance = contentHeight - (windowHeight - headerOffset);
          if (scrollDistance <= 0) {
            // Article is shorter than viewport; 100% once scrolled into view
            progress = 100;
          } else {
            const currentScroll = -contentTop;
            progress = Math.min(100, Math.max(0, (currentScroll / scrollDistance) * 100));
          }
        }
      }

      barRef.current.style.width = `${progress}%`;
      barRef.current.setAttribute("aria-valuenow", String(Math.round(progress)));
    }

    function onScrollOrResize() {
      if (rafId.current !== null) {
        cancelAnimationFrame(rafId.current);
      }
      rafId.current = requestAnimationFrame(updateProgress);
    }

    // Initial calculation
    updateProgress();

    const scrollElem = scrollContainerRef?.current;
    if (scrollElem) {
      scrollElem.addEventListener("scroll", onScrollOrResize, { passive: true });
    } else {
      window.addEventListener("scroll", onScrollOrResize, { passive: true });
    }
    window.addEventListener("resize", onScrollOrResize, { passive: true });

    return () => {
      if (scrollElem) {
        scrollElem.removeEventListener("scroll", onScrollOrResize);
      }
      window.removeEventListener("scroll", onScrollOrResize);
      window.removeEventListener("resize", onScrollOrResize);
      if (rafId.current !== null) {
        cancelAnimationFrame(rafId.current);
      }
    };
  }, [targetRef, scrollContainerRef]);

  return (
    <div
      className={`fixed top-0 left-0 right-0 z-50 h-[3px] bg-transparent pointer-events-none ${className}`}
      role="progressbar"
      aria-label="Reading progress"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={0}
    >
      <div
        ref={barRef}
        className="h-full bg-moss dark:bg-primary transition-[width] duration-75 ease-out motion-reduce:transition-none shadow-[0_0_8px_rgba(38,60,53,0.3)] dark:shadow-[0_0_8px_rgba(168,193,174,0.4)]"
        style={{ width: "0%" }}
      />
    </div>
  );
}
