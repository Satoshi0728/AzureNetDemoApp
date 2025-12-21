import { useLocation } from "react-router-dom";
import { useNavigateWithScroll } from "../hooks/useNavigateWithScroll";

const FEEDBACK_GITHUB_URL = "https://github.com/Satoshi0728/AzureNetDemoApp/issues/new";


// CTA footer with inline lead form (client-side only to avoid storing addresses).
export const SiteFooter = () => {
  const location = useLocation();
  const { createClickHandler } = useNavigateWithScroll();
  const linkBehavior = location.pathname === "/" ? "smooth" : "auto";

  const handleFeedbackClick = () => {
    window.open(FEEDBACK_GITHUB_URL, "_blank", "noopener,noreferrer");
  };

  return (
    <footer className="section section-footer" id="cta">
      <div className="container footer-grid">
        <section className="footer-cta" aria-label="King of Ofuro's Network App">
          <div>
            <span className="brand-foot">King of Ofuro's Network App</span>
            <p className="footer-cta">
              Azure Network 検証用アプリケーションを使っていただきありがとうございます。
            </p>
          </div>

          <div className="footer-actions">
            <button type="button" className="btn btn-ghost btn-lg footer-feedback-btn" onClick={handleFeedbackClick}>
              このアプリケーションに関するフィードバック
            </button>
          </div>
        </section>

        <section className="footer-meta" aria-label="サイトナビゲーション">
          <div className="footer-meta__group">
            <span className="footer-meta__label">クイックリンク</span>
            <ul className="footer-links">
              <li>
                <a href="/#top" onClick={createClickHandler("#top", { behavior: linkBehavior })}>
                  トップ ページへ
                </a>
              </li>
              <li>
                <a href="/#tools" onClick={createClickHandler("#tools", { behavior: linkBehavior })}>
                  ツール一覧
                </a>
              </li>
              <li>
                <a href="/#apis" onClick={createClickHandler("#apis", { behavior: linkBehavior })}>
                  API 一覧
                </a>
              </li>
              <li>
                <a href="/#features" onClick={createClickHandler("#features", { behavior: linkBehavior })}>
                  リソース アイコン
                </a>
              </li>
            </ul>
          </div>

          <div className="footer-meta__group">
            <span className="footer-meta__label">プラットフォーム</span>
            <p className="footer-meta__detail">Express API · React · Vite · Azure App Service</p>
          </div>

          <a
            className="footer-copy"
            href="https://github.com/Satoshi0728/"
            target="_blank"
            rel="noreferrer"
          >
            © {new Date().getFullYear()} King of Ofuro. All rights reserved.
          </a>
        </section>
      </div>
    </footer>
  );
};
