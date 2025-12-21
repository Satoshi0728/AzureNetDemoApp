import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ToolPage } from "../components/ToolPage.jsx";
import { useApiResource } from "../hooks/useApiResource.js";
import { copyToClipboard } from "../utils/clipboard.js";

const HISTORY_LIMIT = 5;
// ページ遷移では消えないようにする（リロードでのみ初期化）。
let persistentHistory = [];
export const __resetHistoryForTest = () => {
  // 画面遷移間での共有を壊さないよう、本番では使わずテスト専用で履歴を初期化。
  persistentHistory = [];
};
const formatField = (value) => (value ? value : "(none)");
const formatTimestamp = (value) => {
  if (!value) return "—";
  const date = value instanceof Date ? value : new Date(value);
  return date.toLocaleString();
};

export const IpFqdnPage = () => {
  const { data, status, error, reload } = useApiResource("/api/v1/ip-fqdn");
  const [copiedTarget, setCopiedTarget] = useState(null);
  const [history, setHistory] = useState(() => persistentHistory);
  const resetTimerRef = useRef(null);
  const isLoading = status === "loading";

  const client = data?.client ?? {};
  const fqdn = data?.fqdn ?? {};
  const retrievedAt = data?.generatedAt ? new Date(data.generatedAt).toLocaleString() : "—";

  const scheduleCopiedReset = () => {
    if (resetTimerRef.current) {
      window.clearTimeout(resetTimerRef.current);
    }
    resetTimerRef.current = window.setTimeout(() => {
      setCopiedTarget(null);
      resetTimerRef.current = null;
    }, 900);
  };

  useEffect(() => {
    return () => {
      if (resetTimerRef.current) {
        window.clearTimeout(resetTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (status !== "success" || !data) return;
    const entry = {
      at: new Date(),
      ip: data.client?.ip ?? null,
      source: data.client?.source ?? "remoteAddr",
      host: data.fqdn?.host ?? null,
      url: data.fqdn?.url ?? null,
    };
    setHistory((prev) => {
      const next = [...prev, entry].slice(-HISTORY_LIMIT);
      persistentHistory = next;
      return next;
    });
  }, [data, status]);

  const handleIPCopy = async () => {
    if (!client.ip) return;
    const ok = await copyToClipboard(client.ip);
    if (ok) {
      setCopiedTarget("ip");
      scheduleCopiedReset();
    } else {
      window.alert("コピーに失敗しました");
    }
  };

  const handleHostCopy = async () => {
    if (!fqdn.host) return;
    const ok = await copyToClipboard(fqdn.host);
    if (ok) {
      setCopiedTarget("host");
      scheduleCopiedReset();
    } else {
      window.alert("コピーに失敗しました");
    }
  };

  return (
    <ToolPage
      title="クライアント IP / FQDN チェッカー"
      description="クライアント IP と接続先の Host / URL を確認できます。プロキシ配下での疎通確認やヘッダー検証に便利です。"
      actions={
        <div className="tool-button-bar">
          <button type="button" className="btn btn-sm" onClick={reload} disabled={isLoading}>
            {isLoading ? "更新中..." : "情報を再取得"}
          </button>
          <button type="button" className="btn btn-sm btn-ghost" onClick={handleIPCopy} disabled={!client.ip}>
            {copiedTarget === "ip" ? "コピー済み ✅" : "IPをコピー"}
          </button>
          <button type="button" className="btn btn-sm btn-ghost" onClick={handleHostCopy} disabled={!fqdn.host}>
            {copiedTarget === "host" ? "コピー済み ✅" : "Host をコピー"}
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
          <span className="tool-chip">Resolved IP</span>
          <h2>{client.ip ?? (isLoading ? "取得中..." : "—")}</h2>
        </header>
        <dl className="tool-meta">
          <div>
            <dt>判定ソース</dt>
            <dd>{client.source ?? "remoteAddr"}</dd>
          </div>
        </dl>
        <div className="tool-card-gap" aria-hidden="true" />
        <header className="tool-card-header">
          <span className="tool-chip">Host Header</span>
          <h2>{formatField(fqdn.host)}</h2>
        </header>
        <dl className="tool-detail-grid">
          <div>
            <dt>URL</dt>
            <dd>
              <code className="tool-url">{formatField(fqdn.url)}</code>
            </dd>
          </div>
        </dl>
        <dl className="tool-meta tool-page-meta tool-page-meta-inline" aria-live="polite">
          <div>
            <dt>取得時刻</dt>
            <dd>{retrievedAt}</dd>
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
                  <th scope="col">Client IP</th>
                  <th scope="col">判定ソース</th>
                  <th scope="col">Host</th>
                </tr>
              </thead>
              <tbody>
                {history.map((entry, index) => (
                  <tr key={`${entry.at?.getTime?.() ?? index}-${index}`}>
                    <td>#{index + 1}</td>
                    <td>{formatTimestamp(entry.at)}</td>
                    <td>{entry.ip ?? "—"}</td>
                    <td>{entry.source ?? "remoteAddr"}</td>
                    <td>{entry.host ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </article>
    </ToolPage>
  );
};
