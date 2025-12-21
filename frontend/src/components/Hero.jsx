import { useNavigateWithScroll } from "../hooks/useNavigateWithScroll";
import { contentDefaults } from "../constants/contentDefaults.js";
import {
  heroMetricsConfig,
  heroConsoleFooterBadges,
  heroConsoleFlowSegments,
} from "../constants/heroContent.js";

const Counter = ({ value, fallback, decimals }) => {
  const safeValue = typeof value === "number" ? value : fallback;
  return safeValue.toFixed(decimals);
};

const ConsoleFlow = () => (
  <div className="console-flow" role="group" aria-label="エッジからアプリへのルーティング">
    {heroConsoleFlowSegments.map((segment, index) => (
      <div
        key={segment.id}
        className={`console-flow__item console-flow__item--delay-${index}`}
        data-motion="slide"
      >
        <div className="console-flow__icon" data-motion="orbit">
          <img src={segment.icon} alt={segment.label} loading="lazy" />
        </div>
        <div className="console-flow__meta">
          <strong>{segment.label}</strong>
        </div>
        <span className="console-flow__accent">{segment.accent}</span>
        {index < heroConsoleFlowSegments.length && (
          <span className="console-flow__connector" aria-hidden="true">
            <span className="console-flow__connector-glow" />
          </span>
        )}
      </div>
    ))}
  </div>
);

export const Hero = ({ counterValues }) => {
  const { createClickHandler } = useNavigateWithScroll();

  return (
    <section className="section hero" id="top">
      <div className="container hero-grid">
        <div className="hero-copy" data-animate="fade-up">
          <div className="label">AZURE INFRA PLATFORM</div>
          <h1>
            ようこそAzureネットワーク<span>検証用アプリケーションページ</span>へ!
          </h1>
          <div className="hero-signal-band" role="list">
          </div>
          <div className="cta-group">
            <a href="#tools" className="btn btn-lg" onClick={createClickHandler("#tools")}>
              ツールを試す
            </a>
            <a href="#features" className="btn btn-ghost btn-lg" onClick={createClickHandler("#features")}>
              リソースアイコンを見る
            </a>
          </div>
          <dl className="hero-metrics">
            {heroMetricsConfig.map((metric) => (
              <div key={metric.id}>
                <dt>{metric.label}</dt>
                <dd>
                  <span>
                    <Counter
                      value={counterValues?.[metric.id]}
                      fallback={contentDefaults.metrics[metric.id]}
                      decimals={metric.decimals}
                    />
                  </span>
                  {metric.suffix}
                </dd>
              </div>
            ))}
          </dl>
        </div>
        <div className="hero-visual">
          <div className="azure-console" data-animate="fade-up" aria-label="Azure ネットワークフローの概要">
            <div className="azure-console__header">
              <span className="azure-console__badge">AZURE NETWORK CLOUD</span>
              <span className="azure-console__status">
                <span className="status-led" aria-hidden="true" />
                connected
              </span>
            </div>
            <div className="azure-console__grid" role="presentation">
              <div className="console-main">
                <ConsoleFlow />
              </div>
            </div>
            <div className="azure-console__footer">
              {heroConsoleFooterBadges.map((badge) => (
                <span key={badge} className="console-footer__badge">
                  {badge}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
