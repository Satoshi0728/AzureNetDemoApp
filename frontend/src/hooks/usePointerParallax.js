import { useEffect } from "react";

// Lightweight pointer-driven parallax; keeps the original interaction without external libraries.
export const usePointerParallax = (selector = ".orb") => {
  useEffect(() => {
    const nodes = document.querySelectorAll(selector);
    if (nodes.length === 0) {
      return undefined;
    }

    const handlePointer = (event) => {
      const { innerWidth, innerHeight } = window;
      const x = ((event.clientX ?? innerWidth / 2) / innerWidth - 0.5) * 20;
      const y = ((event.clientY ?? innerHeight / 2) / innerHeight - 0.5) * 20;
      nodes.forEach((node, index) => {
        const depth = (index + 1) * 4;
        node.style.transform = `translate3d(${x / depth}px, ${y / depth}px, 0)`;
      });
    };

    window.addEventListener("pointermove", handlePointer);
    return () => window.removeEventListener("pointermove", handlePointer);
  }, [selector]);
};
