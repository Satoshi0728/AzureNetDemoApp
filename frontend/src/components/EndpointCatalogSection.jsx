import { useCallback, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { copyToClipboard } from "../utils/clipboard.js";
import { useEndpointCatalog } from "../hooks/useEndpointCatalog.js";

const CatalogSection = ({
  title,
  description,
  sectionId,
  filterFn = () => true,
  emptyText = "該当するエンドポイントが見つかりませんでした。",
  badgeLabel,
  className,
  searchLabel = "エンドポイント検索",
  endpoints = [],
  loading = false,
  error = null,
}) => {
  const [query, setQuery] = useState("");
  const [copiedPath, setCopiedPath] = useState("");

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    return endpoints
      .filter((entry) => filterFn(entry))
      .filter((entry) => {
        if (!q) return true;
        const haystack = `${entry.name} ${entry.path} ${entry.description} ${entry.category} ${entry.method}`.toLowerCase();
        return haystack.includes(q);
      });
  }, [endpoints, filterFn, query]);

  const handleCopy = async (path) => {
    const origin = window.location.origin;
    const absolute = new URL(path, origin).toString();
    const ok = await copyToClipboard(absolute);
    if (ok) {
      setCopiedPath(path);
      setTimeout(() => setCopiedPath(""), 1400);
    } else {
      window.alert("URLのコピーに失敗しました");
    }
  };

  return (
    <section className={`section tool-showcase${className ? ` ${className}` : ""}`} id={sectionId}>
      <div className="container">
        <header className="section-headline">
          <span className="label">{badgeLabel ?? "Endpoint Catalog"}</span>
          <h2>{title}</h2>
          <p>{description}</p>
        </header>
        <div className="tool-search">
          <label htmlFor={`${sectionId}-search`} className="sr-only">
            {searchLabel}
          </label>
          <input
            id={`${sectionId}-search`}
            type="search"
            placeholder="パスや説明で絞り込み..."
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            disabled={loading}
          />
          <span aria-hidden="true">🔍</span>
        </div>
        {error ? <p className="tool-error">{error}</p> : null}
        <div className="endpoint-grid" aria-live="polite">
          {loading ? (
            <div className="tool-skeleton">読み込み中...</div>
          ) : results.length === 0 ? (
            <div className="tool-empty">{emptyText}</div>
          ) : (
            results.map((entry) => {
              const isApi = entry.path.startsWith("/api");
              const copyActive = copiedPath === entry.path;
              return (
                <article key={`${entry.method}:${entry.path}`} className="endpoint-card">
                  <div className="endpoint-card-head">
                    <span className={`endpoint-method ${entry.category}`}>{entry.method}</span>
                    {entry.statusCode && entry.statusCode !== 200 ? (
                      <span className="endpoint-status">HTTP {entry.statusCode}</span>
                    ) : null}
                  </div>
                  <h3>{entry.name}</h3>
                  <p>{entry.description}</p>
                  <code>{entry.path}</code>
                  <div className="endpoint-actions">
                    {isApi ? (
                      <a className="btn btn-sm btn-ghost" href={entry.path} target="_blank" rel="noreferrer">
                        開く
                      </a>
                    ) : (
                      <Link className="btn btn-sm" to={entry.path}>
                        表示する
                      </Link>
                    )}
                    <button
                      type="button"
                      className="btn btn-sm btn-ghost"
                      onClick={() => handleCopy(entry.path)}
                    >
                      {copyActive ? "コピー済み ✅" : "URLコピー"}
                    </button>
                  </div>
                  <span className={`endpoint-category category-${entry.category}`}>{entry.category}</span>
                </article>
              );
            })
          )}
        </div>
      </div>
    </section>
  );
};

export const ToolsCatalogSection = ({ endpoints, loading, error }) => {
  const filterFn = useCallback(
    (entry) => entry.category === "page" && !entry.path.startsWith("/api"),
    [],
  );
  return (
    <CatalogSection
      sectionId="tools"
      className="tools-showcase"
      badgeLabel="Tools"
      title="ユーティリティ"
      description="ページやツールへのショートカットです。コピーして共有したり、ページを開いて挙動を確認できます。"
      filterFn={filterFn}
      emptyText="ページカテゴリのエンドポイントが見つかりませんでした。"
      searchLabel="ツール検索"
      endpoints={endpoints}
      loading={loading}
      error={error}
    />
  );
};

export const APIsCatalogSection = ({ endpoints, loading, error }) => {
  const filterFn = useCallback(
    (entry) => entry.category === "api" || entry.path.startsWith("/api"),
    [],
  );
  return (
    <CatalogSection
      sectionId="apis"
      className="api-showcase"
      badgeLabel="APIs"
      title="API エンドポイント"
      description="デバッグや検証に使える API 一覧です。URL をコピーして他のツールに貼り付けられます。"
      filterFn={filterFn}
      emptyText="API カテゴリのエンドポイントが見つかりませんでした。"
      searchLabel="API 検索"
      endpoints={endpoints}
      loading={loading}
      error={error}
    />
  );
};

// Convenience container used when both sections should be rendered together.
export const EndpointCatalogContainer = () => {
  const { endpoints, loading, error } = useEndpointCatalog();
  return (
    <>
      <ToolsCatalogSection endpoints={endpoints} loading={loading} error={error} />
      <APIsCatalogSection endpoints={endpoints} loading={loading} error={error} />
    </>
  );
};

export { CatalogSection };
