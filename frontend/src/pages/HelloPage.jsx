import { Link } from "react-router-dom";
import { ToolPage } from "../components/ToolPage.jsx";
import { useApiResource } from "../hooks/useApiResource.js";

export const HelloPage = () => {
  const { data, status, error, reload } = useApiResource("/api/v1/hello");

  const isLoading = status === "loading";

  return (
    <ToolPage
      title="Hello ページ"
      description="Back End から取得したメッセージを表示するサンプルページです。"
      actions={
        <div className="tool-button-bar">
          <button type="button" className="btn btn-sm" onClick={reload} disabled={isLoading}>
            {isLoading ? "更新中..." : "メッセージを再取得"}
          </button>
          <Link className="btn btn-sm btn-ghost" to="/" state={{ scrollToTop: true }}>
            ホームへ戻る
          </Link>
        </div>
      }
    >
      <article className="tool-card">
        <header>
          <h2>{data?.title ?? "読み込み中..."}</h2>
        </header>
        <p className="tool-main-text">{data?.message ?? ""}</p>
        <dl className="tool-meta">
          <div>
            <dt>最終更新</dt>
            <dd>{data?.generatedAt ? new Date(data.generatedAt).toLocaleString() : "—"}</dd>
          </div>
          <div>
            <dt>ステータス</dt>
            <dd>{isLoading ? "更新中" : error ? "エラー" : "最新"}</dd>
          </div>
        </dl>
        {error ? <p className="tool-error">{error}</p> : null}
      </article>
    </ToolPage>
  );
};
