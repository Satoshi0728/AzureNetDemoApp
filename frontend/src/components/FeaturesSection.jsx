import { useEffect, useRef, useState } from "react";
import { azureLogos } from "../constants/azureLogos";

// Features section now focuses solely on the Azure service ticker for lightweight storytelling.
export const FeaturesSection = () => {

  const tickerSegments = [0, 1];
  const TICKER_BADGE_SELECTOR = "[data-ticker-badge='true']";
  const [isDragging, setIsDragging] = useState(false);
  const [position, setPosition] = useState(0);
  const [isHovering, setIsHovering] = useState(false);
  const [selectedLogoId, setSelectedLogoId] = useState(null);
  const [hoveredLogoId, setHoveredLogoId] = useState(null);
  const positionRef = useRef(position);
  const dragContextRef = useRef(null);
  const tickerRef = useRef(null);
  const scrollContainerRef = useRef(null);
  const [cycleWidth, setCycleWidth] = useState(1);
  const cycleWidthRef = useRef(cycleWidth);
  const isDraggingRef = useRef(isDragging);
  const isHoveringRef = useRef(isHovering);
  const clickSuppressionRef = useRef(false);
  const hoverTimeoutRef = useRef(null);
  const lastHoveredLogoRef = useRef(null);

  const selectedLogo = selectedLogoId ? azureLogos.find((logo) => logo.id === selectedLogoId) : null;
  const hoveredLogo = hoveredLogoId ? azureLogos.find((logo) => logo.id === hoveredLogoId) : null;
  const lastHoverLogo = lastHoveredLogoRef.current
    ? azureLogos.find((logo) => logo.id === lastHoveredLogoRef.current)
    : null;
  const activeLogo = hoveredLogo || selectedLogo || (isHovering ? lastHoverLogo : null);

  const wrapOffset = (value, cycle) => {
    if (!cycle) {
      return value;
    }

    while (value < 0) value += cycle;
    while (value >= cycle) value -= cycle;
    return value;
  };

  const setTickerPosition = (value) => {
    const cycle = cycleWidthRef.current || 1;
    const wrapped = wrapOffset(value, cycle);
    positionRef.current = wrapped;
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollLeft = wrapped;
    }
    setPosition((prev) => (prev === wrapped ? prev : wrapped));
  };

  const updateCycleWidth = (node) => {
    if (!node) {
      return;
    }
    const rawWidth = node.scrollWidth / tickerSegments.length || 1;
    setCycleWidth((prev) => {
      if (prev === rawWidth) {
        return prev;
      }
      cycleWidthRef.current = rawWidth;
      return rawWidth;
    });
  };

  const registerTickerRef = (node) => {
    tickerRef.current = node;
    if (node) {
      updateCycleWidth(node);
    }
  };

  useEffect(() => {
    const handleResize = () => {
      if (tickerRef.current) {
        updateCycleWidth(tickerRef.current);
      }
    };

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    cycleWidthRef.current = cycleWidth;
  }, [cycleWidth]);

  useEffect(() => {
    isDraggingRef.current = isDragging;
  }, [isDragging]);

  useEffect(() => {
    isHoveringRef.current = isHovering;
  }, [isHovering]);

  useEffect(() => {
    let frame;
    let lastTime;

    const tick = (time) => {
      if (!lastTime) {
        lastTime = time;
        frame = requestAnimationFrame(tick);
        return;
      }

      const deltaSeconds = (time - lastTime) / 1000;
      lastTime = time;

      setPosition((prev) => {
        if (isDraggingRef.current || isHoveringRef.current) {
          return prev;
        }

        const cycle = cycleWidthRef.current || 1;
        const speed = cycle / 28;
        const candidate = wrapOffset(prev + speed * deltaSeconds, cycle);
        if (candidate !== prev) {
          positionRef.current = candidate;
          if (scrollContainerRef.current) {
            scrollContainerRef.current.scrollLeft = candidate;
          }
          return candidate;
        }

        return prev;
      });

      frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);

  const handlePointerDown = (event) => {
    if (event.pointerType === "mouse" && event.button !== 0) {
      return;
    }

    const originatedFromBadge = Boolean(event.target.closest(TICKER_BADGE_SELECTOR));

    if (!originatedFromBadge) {
      event.preventDefault();
    }
    const pointerId = event.pointerId;
    clickSuppressionRef.current = false;
    dragContextRef.current = {
      pointerId,
      startX: event.clientX,
      startPos: scrollContainerRef.current?.scrollLeft || 0,
      moved: false,
      fromBadge: originatedFromBadge,
    };
    event.currentTarget.setPointerCapture(pointerId);
    setIsDragging(true);
  };

  const handlePointerMove = (event) => {
    const context = dragContextRef.current;
    if (!context) {
      return;
    }

    if (!context.fromBadge || context.moved) {
      event.preventDefault();
    }
    const cycle = cycleWidthRef.current || 1;
    const delta = event.clientX - context.startX;
    if (!context.moved && Math.abs(delta) > 3) {
      context.moved = true;
    }
    const wrapped = wrapOffset(context.startPos - delta, cycle);
    setTickerPosition(wrapped);
  };

  const handlePointerEnd = (event) => {
    const context = dragContextRef.current;
    if (!context) {
      return;
    }

    if (!context.fromBadge || context.moved) {
      event.preventDefault();
    }
    if (event.currentTarget.hasPointerCapture(context.pointerId)) {
      event.currentTarget.releasePointerCapture(context.pointerId);
    }
    clickSuppressionRef.current = !!context.moved;
    dragContextRef.current = null;
    setIsDragging(false);
  };

  const cancelHoverTimeout = () => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
  };

  const scheduleHoverEnd = () => {
    cancelHoverTimeout();
    hoverTimeoutRef.current = setTimeout(() => {
      setIsHovering(false);
      hoverTimeoutRef.current = null;
    }, 200);
  };

  const beginHover = (logoId) => {
    cancelHoverTimeout();
    setHoveredLogoId(logoId);
    lastHoveredLogoRef.current = logoId;
    if (!isHoveringRef.current) {
      setIsHovering(true);
    }
  };

  const endHover = () => {
    setHoveredLogoId(null);
    scheduleHoverEnd();
  };

  const keepPanelActive = () => {
    if (!isHoveringRef.current) {
      setIsHovering(true);
    }
    cancelHoverTimeout();
  };

  const releasePanelActive = () => {
    if (!hoveredLogoId) {
      scheduleHoverEnd();
    }
  };

  const handleBadgeClick = (logoId) => {
    if (clickSuppressionRef.current) {
      clickSuppressionRef.current = false;
      return;
    }
    setSelectedLogoId((prev) => (prev === logoId ? null : logoId));
  };

  useEffect(() => () => cancelHoverTimeout(), []);

  return (
    <section className="section feature-ticker-section" id="features" aria-labelledby="feature-ticker-title">
      <div className="feature-ticker__halo" aria-hidden="true" />
      <div className="container feature-ticker__container">
        <header className="feature-ticker__copy section-headline" data-animate="fade-up">
          <span className="label">Azure resource spotlight</span>
          <h2 id="feature-ticker-title">Azure リソースのアイコン一覧</h2>
          <p>
            App Service や Cosmos DB、Application Gateway など Azure クラウドのパワフルなリソースを、確認してみましょう。
          </p>
        </header>

        <div
          className="feature-ticker"
          role="region"
          aria-live="off"
          aria-label="Azure サービス ロゴのティッカー"
          ref={scrollContainerRef}
        >
          <div
            className={`feature-ticker__track${isDragging ? " is-user-controlled" : ""}`}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerEnd}
            onPointerCancel={handlePointerEnd}
            ref={registerTickerRef}
          >
            {tickerSegments.map((segment) => (
              <div className="feature-ticker__row" key={`ticker-row-${segment}`}>
                {azureLogos.map((logo) => {
                  const isSelected = selectedLogoId === logo.id;
                  return (
                    <button
                      key={`ticker-${segment}-${logo.id}`}
                      type="button"
                      className={`feature-ticker__badge${isSelected ? " is-selected" : ""}`}
                      data-ticker-badge="true"
                      aria-selected={isSelected}
                      aria-label={`${logo.label} を選択`}
                      onClick={() => handleBadgeClick(logo.id)}
                      onMouseEnter={() => beginHover(logo.id)}
                      onMouseLeave={endHover}
                      onFocus={() => beginHover(logo.id)}
                      onBlur={endHover}
                    >
                      <img src={logo.src} alt="" role="presentation" loading="lazy" />
                      <span className="sr-only">{logo.label}</span>
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        <div
          className={`feature-ticker__selection-slot${activeLogo ? "" : " is-empty"}`}
          aria-live="polite"
        >
          {activeLogo && (
            <div
              className="feature-ticker__selection"
              role="status"
              tabIndex={-1}
              onMouseEnter={keepPanelActive}
              onMouseLeave={releasePanelActive}
              onFocus={keepPanelActive}
              onBlur={releasePanelActive}
            >
              <div className="feature-ticker__selection-info">
                <img src={activeLogo.src} alt="" role="presentation" loading="lazy" />
                <div>
                  <p className="feature-ticker__selection-label">{activeLogo.label}</p>
                  <p className="feature-ticker__selection-hint">概要ボタンから公式ドキュメントを開きます。</p>
                </div>
              </div>
              <div className="feature-ticker__selection-actions">
                <a
                  className="btn btn-sm feature-ticker__selection-button"
                  href={activeLogo.href}
                  target="_blank"
                  rel="noreferrer noopener"
                  onFocus={keepPanelActive}
                  onBlur={releasePanelActive}
                >
                  概要を開く
                </a>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};
