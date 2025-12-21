import { useEffect } from "react";

// Observer-based reveal animation reused across sections.
export const useRevealOnScroll = () => {
  useEffect(() => {
    const animatedNodes = document.querySelectorAll("[data-animate]");

    if (animatedNodes.length === 0) {
      return undefined;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const delay = entry.target.dataset.delay ? parseInt(entry.target.dataset.delay, 10) : 0;
            window.setTimeout(() => entry.target.classList.add("is-visible"), delay);
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15 }
    );

    animatedNodes.forEach((node) => observer.observe(node));

    return () => observer.disconnect();
  }, []);
};
