import { useEffect, useMemo, useState } from "react";
import { Route, Routes, useLocation, useNavigate } from "react-router-dom";
import "./app.css";
import { useBodyClass } from "./hooks/useBodyClass.js";
import { SiteHeader } from "./components/SiteHeader.jsx";
import { SiteFooter } from "./components/SiteFooter.jsx";
import { LandingPage } from "./pages/LandingPage.jsx";
import { HelloPage } from "./pages/HelloPage.jsx";
import { HeadersPage } from "./pages/HeadersPage.jsx";
import { NotFoundPage } from "./pages/NotFoundPage.jsx";
import { IpFqdnPage } from "./pages/IpFqdnPage.jsx";
import { HttpStatusPage } from "./pages/HttpStatus.jsx";
import { TimeTakenPage } from "./pages/TimeTakenPage.jsx";

const LANDING_NAV = [
  { id: "tools", label: "ツール一覧", href: "#tools", type: "anchor" },
  { id: "apis", label: "API", href: "#apis", type: "anchor" },
  { id: "features", label: "リソース アイコン", href: "#features", type: "anchor" },
  { id: "utilities", label: "ユーティリティ", href: "/tools/ip-fqdn", type: "link", variant: "button" },
];

const UTILITY_NAV = [
  { id: "tools", label: "ツール一覧", href: "#tools", type: "anchor" },
  { id: "ipfqdn", label: "IP / FQDN", href: "/tools/ip-fqdn", type: "link" },
  { id: "headers", label: "HTTP ヘッダー", href: "/tools/http-headers", type: "link" },
  { id: "httpstatus", label: "HTTP ステータス", href: "/tools/http-status", type: "link" },
  { id: "timetaken", label: "遅延レスポンス", href: "/tools/timetaken", type: "link" },
  { id: "home", label: "ホーム", href: "/", type: "link", variant: "button" },
];

const normalizeHash = (value) => {
  if (!value) return "";
  return value.startsWith("#") ? value : `#${value}`;
};

const scrollToHash = (hash) => {
  if (!hash) return;
  const target = document.querySelector(hash);
  if (target) {
    target.scrollIntoView({ behavior: "smooth", block: "start" });
  }
};

export default function App() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [pendingHash, setPendingHash] = useState(null);
  const [pendingScrollMode, setPendingScrollMode] = useState(null);
  const location = useLocation();
  const navigate = useNavigate();
  const isLanding = location.pathname === "/" || location.pathname === "";

  useBodyClass(menuOpen, "is-menu-open");

  const navItems = useMemo(() => (isLanding ? LANDING_NAV : UTILITY_NAV), [isLanding]);

  const handleMenuToggle = () => setMenuOpen((prev) => !prev);

  const handleNavigate = (item, event) => {
    if (event) {
      event.preventDefault();
    }

    if (item?.type === "anchor") {
      const hash = normalizeHash(item.href);
      const isBrand = item.id === "brand";
      if (isLanding) {
        requestAnimationFrame(() => scrollToHash(hash));
      } else {
        if (isBrand) {
          setPendingHash(null);
          setPendingScrollMode("instant-top");
        } else {
          setPendingHash(hash);
          setPendingScrollMode(null);
        }
        navigate("/");
      }
    } else if (item?.type === "link") {
      navigate(item.href);
      if (item.href === "/") {
        requestAnimationFrame(() => {
          window.scrollTo({ top: 0, behavior: "auto" });
        });
      }
    } else if (item?.type === "external" && item.href) {
      window.location.href = item.href;
      return;
    }

    setMenuOpen(false);
  };

  useEffect(() => {
    const handleDocumentClick = (event) => {
      if (!menuOpen) return;
      const nav = document.querySelector(".main-nav");
      const toggle = document.querySelector(".menu-toggle");
      if (nav && toggle && !nav.contains(event.target) && !toggle.contains(event.target)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("click", handleDocumentClick);
    return () => document.removeEventListener("click", handleDocumentClick);
  }, [menuOpen]);

  useEffect(() => {
    if (!pendingHash || !isLanding) return;
    requestAnimationFrame(() => {
      scrollToHash(pendingHash);
      setPendingHash(null);
    });
  }, [pendingHash, isLanding]);

  useEffect(() => {
    if (!pendingScrollMode || !isLanding) return;
    if (pendingScrollMode === "instant-top") {
      requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: "auto" }));
    }
    setPendingScrollMode(null);
  }, [pendingScrollMode, isLanding]);

  useEffect(() => {
    if (!isLanding) return;
    const shouldScrollTop = location.state?.scrollToTop === true;
    if (!shouldScrollTop) return;
    requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: "auto" }));
    navigate(location.pathname + location.search + location.hash, { replace: true, state: null });
  }, [isLanding, location.hash, location.pathname, location.search, location.state, navigate]);

  useEffect(() => {
    if (!isLanding || !location.hash) return;
    requestAnimationFrame(() => scrollToHash(normalizeHash(location.hash)));
  }, [isLanding, location.hash]);

  useEffect(() => {
    if (isLanding) return;
    window.scrollTo({ top: 0, behavior: "auto" });
  }, [isLanding, location.pathname]);

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  return (
    <>
      <div className="page-background">
        <div className="orb orb-one" />
        <div className="orb orb-two" />
        <div className="orb orb-three" />
      </div>
      <SiteHeader menuOpen={menuOpen} navItems={navItems} onToggle={handleMenuToggle} onNavigate={handleNavigate} />
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/tools/hello" element={<HelloPage />} />
        <Route path="/tools/ip-fqdn" element={<IpFqdnPage />} />
        <Route path="/tools/http-headers" element={<HeadersPage />} />
        <Route path="/tools/http-status" element={<HttpStatusPage />} />
        <Route path="/tools/timetaken" element={<TimeTakenPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
      <SiteFooter />
    </>
  );
}
