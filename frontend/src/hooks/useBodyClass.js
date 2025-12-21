import { useEffect } from "react";

// Syncs a CSS class with the document body (used for mobile menu state).
export const useBodyClass = (enabled, className) => {
  useEffect(() => {
    if (!className) return undefined;
    if (enabled) {
      document.body.classList.add(className);
    } else {
      document.body.classList.remove(className);
    }
    return () => document.body.classList.remove(className);
  }, [enabled, className]);
};
