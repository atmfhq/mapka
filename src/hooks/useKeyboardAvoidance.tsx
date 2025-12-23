import { useEffect, useRef } from "react";

/**
 * Hook that handles mobile keyboard avoidance by:
 * 1. Scrolling focused inputs into view
 * 2. Adjusting container padding when keyboard is visible
 */
export function useKeyboardAvoidance() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Handle input focus - scroll input into view
    const handleFocusIn = (e: FocusEvent) => {
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      ) {
        // Small delay to let keyboard open
        setTimeout(() => {
          target.scrollIntoView({
            behavior: "smooth",
            block: "center",
            inline: "nearest",
          });
        }, 300);
      }
    };

    // Handle visual viewport resize (keyboard open/close)
    const handleViewportResize = () => {
      if (!window.visualViewport) return;
      
      const viewportHeight = window.visualViewport.height;
      const windowHeight = window.innerHeight;
      const keyboardHeight = windowHeight - viewportHeight;
      
      // Add bottom padding when keyboard is open
      if (keyboardHeight > 100) {
        container.style.paddingBottom = `${keyboardHeight + 20}px`;
      } else {
        container.style.paddingBottom = "";
      }
    };

    container.addEventListener("focusin", handleFocusIn);
    
    if (window.visualViewport) {
      window.visualViewport.addEventListener("resize", handleViewportResize);
    }

    return () => {
      container.removeEventListener("focusin", handleFocusIn);
      if (window.visualViewport) {
        window.visualViewport.removeEventListener("resize", handleViewportResize);
      }
    };
  }, []);

  return containerRef;
}
