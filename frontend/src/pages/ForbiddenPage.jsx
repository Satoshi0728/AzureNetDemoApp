import { Link } from "react-router-dom";
import { ToolPage } from "../components/ToolPage.jsx";
import { useApiResource } from "../hooks/useApiResource.js";

export const ForbiddenPage = () => {
  const { data, status, error, httpStatus, reload } = useApiResource("/api/v1/forbidden");
  const isLoading = status === "loading";

  const code = data?.error?.code ?? "Failed to access resource";
  const apiMessage = data?.error?.message ?? data?.message;
  const message = apiMessage ?? (status !== "error" ? "Access to this resource is forbidden." : null);
  const shouldShowError = Boolean(error && error !== apiMessage);
  const generatedAt = data?.generatedAt;
  const path = data?.path ?? "/api/v1/forbidden";
  const responseStatus = httpStatus ?? data?.statusCode ?? "—";

  return (
    <ToolPage
      title="403 Forbidden"
      description="HTTP ステータスコード 403 応答ページです。アプリケーション ゲートウェイや Front Door の動作確認に活用できます。"
      actions={
        <div className="tool-button-bar">
          <button type="button" className="btn btn-sm" onClick={reload} disabled={isLoading}>
            {isLoading ? "再取得中..." : "403 エラーを再リクエスト"}
          </button>
          <Link className="btn btn-sm btn-ghost" to="/tools/http-headers">
            HTTP ヘッダーを見る
          </Link>
          <Link className="btn btn-sm btn-ghost" to="/" state={{ scrollToTop: true }}>
            ホームへ戻る
          </Link>
        </div>
      }
    >
      <article className="tool-card">
        <header className="tool-card-header">
          <span className="tool-chip">Forbidden</span>
          <h2>{code}</h2>
        </header>
        {message ? <p className="tool-main-text">{message}</p> : null}
        {shouldShowError ? <p className="tool-error">{error}</p> : null}
        <dl className="tool-meta">
          <div>
            <dt>HTTP ステータス</dt>
            <dd>{responseStatus}</dd>
          </div>
          <div>
            <dt>取得時刻</dt>
            <dd>{generatedAt ? new Date(generatedAt).toLocaleString() : "—"}</dd>
          </div>
          <div>
            <dt>path</dt>
            <dd>
              <code className="tool-url">{path}</code>
            </dd>
          </div>
        </dl>
      </article>
    </ToolPage>
  );
};
