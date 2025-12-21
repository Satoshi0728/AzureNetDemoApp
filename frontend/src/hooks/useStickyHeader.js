import { useEffect } from "react";

// Adds `is-scrolled` once the user scrolls beyond the threshold, matching the existing visual design.
export const useStickyHeader = (selector = ".site-header", threshold = 32) => {
  useEffect(() => {
    const header = document.querySelector(selector);
    if (!header) return undefined;

    const handleScroll = () => {
      if (window.scrollY > threshold) {
        header.classList.add("is-scrolled");
      } else {
        header.classList.remove("is-scrolled");
      }
    };

    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [selector, threshold]);
};
