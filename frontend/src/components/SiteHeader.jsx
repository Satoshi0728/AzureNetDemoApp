import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useEndpointCatalog } from "../hooks/useEndpointCatalog.js";

const getUtilityEndpoints = (endpoints) =>
  endpoints
    .filter((entry) => entry?.category === "page" && typeof entry?.path === "string")
    .map((entry) => ({
      name: entry.name,
      path: entry.path,
      description: entry.description,
    }));

const UtilityMenuTrigger = ({ item, onNavigate }) => {
  const { endpoints, loading, error } = useEndpointCatalog();
  const utilities = useMemo(() => getUtilityEndpoints(endpoints), [endpoints]);
  const [isOpen, setIsOpen] = useState(false);
  const [activePath, setActivePath] = useState(null);
  const closeTimeoutRef = useRef(null);

  useEffect(() => {
    if (utilities.length === 0) {
      setActivePath(null);
      return;
    }
    const exists = utilities.some((entry) => entry.path === activePath);
    if (!exists) {
      setActivePath(utilities[0].path);
    }
  }, [utilities, activePath]);

  const handleTabSelect = (entry, event) => {
    if (!entry?.path) return;
    setActivePath(entry.path);
    if (onNavigate) {
      onNavigate({ ...item, href: entry.path, label: entry.name, type: "link" }, event);
    }
    setIsOpen(false);
  };

  const closeMenuIfOutside = (event) => {
    if (!event.currentTarget.contains(event.relatedTarget)) {
      setIsOpen(false);
    }
  };

  useEffect(() => {
    return () => {
      if (closeTimeoutRef.current) {
        clearTimeout(closeTimeoutRef.current);
      }
    };
  }, []);

  const scheduleClose = () => {
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
    }
    closeTimeoutRef.current = setTimeout(() => {
      setIsOpen(false);
      closeTimeoutRef.current = null;
    }, 200);
  };

  const cancelScheduledClose = () => {
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
  };

  const handleTriggerClick = () => {
    cancelScheduledClose();
    setIsOpen((prev) => !prev);
  };

  return (
    <div
      className={`utility-tab-menu${isOpen ? " is-open" : ""}`}
      onMouseEnter={() => {
        cancelScheduledClose();
        setIsOpen(true);
      }}
      onMouseLeave={scheduleClose}
      onFocus={() => setIsOpen(true)}
      onBlur={closeMenuIfOutside}
    >
      <button
        type="button"
        className="btn btn-sm utility-trigger"
        aria-haspopup="true"
        aria-expanded={isOpen}
        onClick={handleTriggerClick}
      >
        {item.label}
      </button>
      <div className="utility-panel" role="menu" aria-label="ユーティリティ一覧">
        {loading ? (
          <p className="utility-panel__status">読み込み中...</p>
        ) : error ? (
          <p className="utility-panel__status">取得に失敗しました</p>
        ) : utilities.length === 0 ? (
          <p className="utility-panel__status">利用できるユーティリティがありません</p>
        ) : (
          utilities.map((entry) => (
            <button
              key={entry.path}
              type="button"
              role="menuitem"
              className={`utility-tab${activePath === entry.path ? " is-active" : ""}`}
              onMouseEnter={() => setActivePath(entry.path)}
              onFocus={() => setActivePath(entry.path)}
              onClick={(event) => handleTabSelect(entry, event)}
            >
              <span className="utility-tab__name">{entry.name}</span>
              <span className="utility-tab__path">{entry.path}</span>
            </button>
          ))
        )}
      </div>
    </div>
  );
};

// Sticky header with responsive navigation. Menu state is controlled by the parent.
export const SiteHeader = ({ menuOpen, navItems, onToggle, onNavigate }) => {
  const location = useLocation();
  const navigate = useNavigate();

  const handleBrandClick = (event) => {
    const topAnchor = "#top";
    const payload = {
      id: "brand",
      type: "anchor",
      href: topAnchor,
      label: "King of Ofuro",
    };

    if (onNavigate) {
      onNavigate(payload, event);
      return;
    }

    event.preventDefault();

    const scrollToTop = () => {
      const target = document.querySelector(topAnchor);
      if (target) {
        target.scrollIntoView({ behavior: "smooth", block: "start" });
        return;
      }
      window.scrollTo({ top: 0, behavior: "smooth" });
    };

    if (location.pathname !== "/") {
      navigate("/");
      requestAnimationFrame(scrollToTop);
      return;
    }

    scrollToTop();
  };

  return (
    <header className={`site-header${menuOpen ? " is-open" : ""}`}>
      <div className="container">
        <a className="brand" href="#top" onClick={handleBrandClick}>
          <span className="brand-mark">♨︎</span>
          <span className="brand-name">King of Ofuro</span>
        </a>
        <nav className="main-nav" aria-label="Primary">
          {navItems?.map((item) => {
            const key = item.id ?? item.href ?? item.label;
            if (item.id === "utilities" && item.variant === "button") {
              return <UtilityMenuTrigger key={key} item={item} onNavigate={onNavigate} />;
            }
            const className = item.variant === "button" ? "btn btn-sm" : undefined;
            const ariaCurrent =
              item.type === "link" && location.pathname === item.href ? "page" : undefined;
            return (
              <a
                key={key}
                href={item.href}
                className={className}
                onClick={(event) => onNavigate?.(item, event)}
                aria-current={ariaCurrent}
              >
                {item.label}
              </a>
            );
          })}
        </nav>
        <button
          className="menu-toggle"
          type="button"
          aria-label="メニューを切り替え"
          aria-expanded={menuOpen}
          onClick={onToggle}
        >
          <span />
          <span />
        </button>
      </div>
    </header>
  );
};