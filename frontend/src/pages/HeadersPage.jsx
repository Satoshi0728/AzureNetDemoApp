import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ToolPage } from "../components/ToolPage.jsx";
import { useApiResource } from "../hooks/useApiResource.js";
import { copyToClipboard } from "../utils/clipboard.js";

const HISTORY_LIMIT = 5;
// ページ遷移では消えないようにする（リロードでのみ初期化）。
let persistentHistory = [];

const formatValues = (values) => {
  if (!Array.isArray(values) || values.length === 0) return "(未受信)";
  const cleaned = values
    .map((value) => (value == null ? "" : String(value).trim()))
    .filter((value) => value.length > 0);
  return cleaned.length > 0 ? cleaned.join(", ") : "(空文字)";
};

const formatTimestamp = (value) => {
  if (!value) return "—";
  const date = value instanceof Date ? value : new Date(value);
  return date.toLocaleString();
};

const buildHeaderLines = (items) => items.map(({ name, value }) => `${name}: ${value}`).join("\n");

const copyHeaderItems = async (items, onSuccess) => {
  if (!items?.length) return false;
  const ok = await copyToClipboard(buildHeaderLines(items));
  if (!ok) {
    window.alert("コピーに失敗しました");
    return false;
  }
  onSuccess?.();
  return true;
};

export const HeadersPage = () => {
  const { data, status, error, reload } = useApiResource("/api/v1/headers");
  const [copied, setCopied] = useState(false);
  const [history, setHistory] = useState(() => persistentHistory);
  const [expandedRows, setExpandedRows] = useState([]);
  const [copiedRows, setCopiedRows] = useState([]);
  const rowCopyTimerRef = useRef({});
  const isLoading = status === "loading";
  const headers = useMemo(() => data?.headers ?? [], [data]);
  const currentHeaderItems = useMemo(
    () =>
      headers.map((row) => ({
        name: row.displayName,
        value: row.present ? formatValues(row.values) : "(未受信)",
        important: !!row.important,
      })),
    [headers]
  );
  const { importantCount, importantTotal } = useMemo(() => {
    const important = headers.filter((row) => row.important);
    return {
      importantCount: important.filter((row) => row.present).length,
      importantTotal: important.length,
    };
  }, [headers]);

  useEffect(() => {
    if (status !== "success" || !data) return;
    const entry = {
      at: new Date(),
      receivedAt: data.receivedAt ?? null,
      headerCount: currentHeaderItems.length,
      headers: currentHeaderItems,
    };
    setHistory((prev) => {
      const next = [...prev, entry].slice(-HISTORY_LIMIT);
      persistentHistory = next;
      return next;
    });
  }, [currentHeaderItems, data?.receivedAt, status]);

  useEffect(() => {
    if (!copied) return undefined;
    const timerId = window.setTimeout(() => setCopied(false), 900);
    return () => window.clearTimeout(timerId);
  }, [copied]);

  useEffect(() => {
    return () => {
      Object.values(rowCopyTimerRef.current).forEach((timerId) => window.clearTimeout(timerId));
      rowCopyTimerRef.current = {};
    };
  }, []);

  const markRowCopiedTemporarily = (index) => {
    setCopiedRows((prev) => (prev.includes(index) ? prev : [...prev, index]));
    if (rowCopyTimerRef.current[index]) {
      window.clearTimeout(rowCopyTimerRef.current[index]);
    }
    rowCopyTimerRef.current[index] = window.setTimeout(() => {
      setCopiedRows((prev) => prev.filter((i) => i !== index));
      delete rowCopyTimerRef.current[index];
    }, 900);
  };

  const copyHeaders = async () => {
    const ok = await copyHeaderItems(currentHeaderItems, () => setCopied(true));
    if (!ok) return;
  };

  return (
    <ToolPage
      title="HTTP ヘッダー インサイト"
      description="現在のリクエストで受信した全ての HTTP ヘッダーを見やすく整理します。Azure Front Door や Application Gateway 固有ヘッダーなど重要な値はハイライト表示します。"
      actions={
        <div className="tool-button-bar">
          <button type="button" className="btn btn-sm" onClick={reload} disabled={isLoading}>
            {isLoading ? "取得中..." : "最新の値に更新"}
          </button>
          <button type="button" className="btn btn-sm btn-ghost" onClick={copyHeaders} disabled={!headers.length || isLoading}>
            {copied ? "コピー済み ✅" : "ヘッダーをコピー"}
          </button>
          <Link className="btn btn-sm btn-ghost" to="/tools/http-status">
            HTTP ステータスへ
          </Link>
          <Link className="btn btn-sm btn-ghost" to="/tools/ip-fqdn">
            IP / FQDN へ
          </Link>
          <Link className="btn btn-sm btn-ghost" to="/" state={{ scrollToTop: true }}>
            ホームへ戻る
          </Link>
        </div>
      }
    >
      <article className="tool-card">
        <div className="tool-table-wrapper">
          <table className="tool-table">
            <thead>
              <tr>
                <th scope="col">ヘッダー</th>
                <th scope="col">値</th>
              </tr>
            </thead>
            <tbody>
              {headers.length === 0 ? (
                <tr>
                  <td colSpan={2}>{isLoading ? "読み込み中..." : "ヘッダー情報が取得できませんでした。"}</td>
                </tr>
              ) : (
                headers.map((row) => (
                  <tr key={row.displayName} className={row.important ? "is-important" : undefined}>
                    <th scope="row">{row.displayName}</th>
                    <td>{row.present ? formatValues(row.values) : "(未受信)"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <dl className="tool-meta">
          <div>
            <dt>重要ヘッダー</dt>
            <dd>
              {importantCount} / {importantTotal}
            </dd>
          </div>
          <div>
            <dt>最終更新</dt>
            <dd>{data?.receivedAt ? new Date(data.receivedAt).toLocaleString() : "—"}</dd>
          </div>
          {error ? (
            <div>
              <dt>エラー</dt>
              <dd className="tool-error">{error}</dd>
            </div>
          ) : null}
        </dl>
      </article>

      <article className="tool-card">
        <header className="tool-card-header">
          <h2>取得履歴</h2>
        </header>
        {history.length === 0 ? (
          <p className="tool-muted">まだ履歴はありません。更新ボタンを押すと追加されます。</p>
        ) : (
          <div className="tool-table-wrapper" aria-label="取得履歴">
            <table className="tool-table">
              <thead>
                <tr>
                  <th scope="col">#</th>
                  <th scope="col">取得時刻</th>
                  <th scope="col">コピー</th>
                  <th scope="col">詳細</th>
                </tr>
              </thead>
              <tbody>
                {history.map((entry, index) => (
                  <Fragment key={`${entry.receivedAt ?? entry.at?.getTime?.() ?? index}-${index}`}>
                    <tr>
                      <td>#{index + 1}</td>
                      <td>{formatTimestamp(entry.receivedAt || entry.at)}</td>
                      <td>
                        <button
                          type="button"
                          className="btn btn-sm btn-ghost"
                          disabled={!entry.headers?.length || isLoading}
                          onClick={async () => {
                            const ok = await copyHeaderItems(entry.headers, () => markRowCopiedTemporarily(index));
                            if (!ok) return;
                          }}
                        >
                          {copiedRows.includes(index) ? "コピー済み✅" : "履歴をコピー"}
                        </button>
                      </td>
                      <td>
                        <button
                          type="button"
                          className="btn btn-sm btn-ghost"
                          onClick={() =>
                            setExpandedRows((prev) =>
                              prev.includes(index)
                                ? prev.filter((id) => id !== index)
                                : [...prev, index]
                            )
                          }
                        >
                          {expandedRows.includes(index) ? "▲ 閉じる" : "▼ 詳細"}
                        </button>
                      </td>
                    </tr>
                    {expandedRows.includes(index) ? (
                      <tr className="is-important" key={`detail-${index}`}>
                        <td colSpan={4}>
                          {entry.headers?.length ? (
                            <div className="tool-table-wrapper">
                              <table className="tool-table">
                                <thead>
                                  <tr>
                                    <th scope="col">ヘッダー</th>
                                    <th scope="col">値</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {entry.headers.map((h, hIdx) => (
                                    <tr key={`${h.name}-${hIdx}`} className={h.important ? "is-important" : undefined}>
                                      <th scope="row">{h.name}</th>
                                      <td>{h.value}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          ) : (
                            <p className="tool-muted">ヘッダー情報は空です。</p>
                          )}
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </article>
    </ToolPage>
  );
};
