import { useCallback, useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";

const normalizeSelector = (value) => {
  if (!value) {
    return "#top";
  }
  return value.startsWith("#") ? value : `#${value}`;
};

const scrollToSelector = (selector, behavior = "smooth") => {
  const target = document.querySelector(selector);
  if (target) {
    target.scrollIntoView({ behavior, block: "start" });
    return;
  }
  window.scrollTo({ top: 0, behavior });
};

export const useNavigateWithScroll = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const pendingTargetRef = useRef(null);

  const performScroll = useCallback((selector, behavior = "smooth") => {
    const normalized = normalizeSelector(selector);
    if (location.pathname !== "/") {
      pendingTargetRef.current = { selector: normalized, behavior };
      navigate("/");
      return;
    }
    scrollToSelector(normalized, behavior);
  }, [location.pathname, navigate]);

  useEffect(() => {
    if (location.pathname !== "/" || !pendingTargetRef.current) {
      return;
    }
    const { selector, behavior } = pendingTargetRef.current;
    pendingTargetRef.current = null;
    requestAnimationFrame(() => scrollToSelector(selector, behavior));
  }, [location.pathname]);

  const createClickHandler = useCallback((selector, options) => (event) => {
    event?.preventDefault();
    performScroll(selector, options?.behavior ?? "smooth");
  }, [performScroll]);

  return {
    createClickHandler,
    navigateWithScroll: performScroll,
  };
};
