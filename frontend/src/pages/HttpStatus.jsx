import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ToolPage } from "../components/ToolPage.jsx";
import { useApiResource } from "../hooks/useApiResource.js";
import { copyToClipboard } from "../utils/clipboard.js";
import { findHttpStatusCatalogEntry } from "../../../shared/http-status-catalog.mjs";
import { directOnlyHttpStatusOptions, supportedHttpStatusOptions } from "../../../shared/http-status-options.mjs";

const DEFAULT_STATUS = "403";
const DEFAULT_DIRECT_ONLY_STATUS = "303";

const buildEndpoint = (statusValue) => `/api/v1/httpstatus?status=${encodeURIComponent(statusValue)}`;

export const HttpStatusPage = () => {
  const [inputValue, setInputValue] = useState(DEFAULT_STATUS);
  const [directOnlyValue, setDirectOnlyValue] = useState(DEFAULT_DIRECT_ONLY_STATUS);
  const [copiedDirectUrl, setCopiedDirectUrl] = useState(false);
  const [copiedCurlCommand, setCopiedCurlCommand] = useState(false);
  const [endpoint, setEndpoint] = useState("");
  const [submittedStatus, setSubmittedStatus] = useState("");
  const { data, status, error, httpStatus, isBodyless, responseMeta, reload } = useApiResource(endpoint, {
    immediate: false,
  });
  const isLoading = status === "loading";
  const hasPayloadResult = typeof data?.statusCode === "number";
  const bodylessResult = useMemo(() => {
    if (status !== "success" || !isBodyless || httpStatus == null) {
      return null;
    }
    const entry = findHttpStatusCatalogEntry(httpStatus);
    if (!entry) {
      return null;
    }
    return {
      statusCode: entry.code,
      statusText: responseMeta?.statusText ?? entry.label,
      description: entry.description,
      generatedAt: responseMeta?.generatedAt ?? null,
      path: endpoint,
      isBodyless: true,
    };
  }, [endpoint, httpStatus, isBodyless, responseMeta, status]);
  const result = hasPayloadResult ? data : bodylessResult;
  const hasResult = Boolean(result);
  const apiErrorMessage = data?.error?.message ?? null;
  const shouldShowError = !hasResult && Boolean(apiErrorMessage ?? error);

  useEffect(() => {
    if (!endpoint) return;
    reload();
  }, [endpoint, reload]);

  const groupedOptions = useMemo(() => {
    const groups = new Map();
    supportedHttpStatusOptions.forEach((entry) => {
      if (!groups.has(entry.group)) {
        groups.set(entry.group, []);
      }
      groups.get(entry.group).push(entry);
    });
    return Array.from(groups.entries());
  }, []);

  const groupedDirectOnlyOptions = useMemo(() => {
    const groups = new Map();
    directOnlyHttpStatusOptions.forEach((entry) => {
      if (!groups.has(entry.group)) {
        groups.set(entry.group, []);
      }
      groups.get(entry.group).push(entry);
    });
    return Array.from(groups.entries());
  }, []);

  const directOnlyEndpoint = buildEndpoint(directOnlyValue);
  const directOnlyAbsoluteUrl = useMemo(() => {
    if (typeof window === "undefined" || !window.location?.origin) {
      return directOnlyEndpoint;
    }
    return new URL(directOnlyEndpoint, window.location.origin).toString();
  }, [directOnlyEndpoint]);
  const directOnlyCurlCommand = useMemo(() => `curl -i '${directOnlyAbsoluteUrl}'`, [directOnlyAbsoluteUrl]);

  useEffect(() => {
    if (!copiedDirectUrl) return undefined;
    const timerId = window.setTimeout(() => setCopiedDirectUrl(false), 1400);
    return () => window.clearTimeout(timerId);
  }, [copiedDirectUrl]);

  useEffect(() => {
    if (!copiedCurlCommand) return undefined;
    const timerId = window.setTimeout(() => setCopiedCurlCommand(false), 1400);
    return () => window.clearTimeout(timerId);
  }, [copiedCurlCommand]);

  const handleSubmit = (event) => {
    event.preventDefault();
    const nextStatus = inputValue.trim();
    const nextEndpoint = buildEndpoint(nextStatus);
    setSubmittedStatus(nextStatus);

    if (nextEndpoint === endpoint) {
      // 同じステータスを再送した場合は endpoint が変わらないため、明示的に再取得する。
      reload();
      return;
    }

    setEndpoint(nextEndpoint);
  };

  const handleCopyDirectUrl = async () => {
    const ok = await copyToClipboard(directOnlyAbsoluteUrl);
    if (ok) {
      setCopiedDirectUrl(true);
      return;
    }
    window.alert("URLのコピーに失敗しました");
  };

  const handleCopyCurlCommand = async () => {
    const ok = await copyToClipboard(directOnlyCurlCommand);
    if (ok) {
      setCopiedCurlCommand(true);
      return;
    }
    window.alert("curl コマンドのコピーに失敗しました");
  };

  return (
    <ToolPage
      title="HTTP ステータス テスター"
      description="HTTP ステータスコードを選択して、API が返すレスポンスコード・名称・説明を確認できます。"
      actions={
        <div className="tool-button-bar">
          <Link className="btn btn-sm btn-ghost" to="/tools/http-headers">
            HTTP ヘッダーを見る
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
        <form className="tool-form" onSubmit={handleSubmit}>
          <label className="tool-field" htmlFor="http-status-input">
            <span className="tool-field-label">HTTP ステータスコードを選択</span>
            <select
              id="http-status-input"
              className="tool-input tool-input--select"
              value={inputValue}
              onChange={(event) => setInputValue(event.target.value)}
            >
              {groupedOptions.map(([groupName, entries]) => (
                <optgroup key={groupName} label={groupName}>
                  {entries.map((entry) => (
                    <option key={entry.code} value={String(entry.code)}>
                      {entry.code} {entry.label}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </label>
          <button type="submit" className="btn btn-sm" disabled={isLoading}>
            {isLoading ? "取得中..." : "ステータスを取得"}
          </button>
        </form>
        <p className="tool-muted tool-note-wide">この一覧はブラウザ fetch で安定して扱えるステータスコードだけに絞っています。</p>
        <dl className="tool-meta">
          <div>
            <dt>入力値</dt>
            <dd>{submittedStatus || "—"}</dd>
          </div>
          <div>
            <dt>API 応答</dt>
            <dd>{httpStatus ?? "—"}</dd>
          </div>
          <div>
            <dt>対象 API</dt>
            <dd>
              <code className="tool-url">{endpoint || "/api/v1/httpstatus?status=..."}</code>
            </dd>
          </div>
        </dl>
      </article>

      <article className="tool-card">
        {hasResult ? (
          <>
            <header className="tool-card-header">
              <span className="tool-chip">HTTP ステータス</span>
              <h2>
                {result.statusCode} {result.statusText}
              </h2>
            </header>
            <p className="tool-main-text">{result.description}</p>
            {result.isBodyless ? (
              <p className="tool-muted">このステータスは HTTP 仕様上レスポンス本文を返さないため、共有カタログの説明を表示しています。</p>
            ) : null}
            <dl className="tool-meta" aria-live="polite">
              <div>
                <dt>ステータスコード</dt>
                <dd>{result.statusCode}</dd>
              </div>
              <div>
                <dt>名称</dt>
                <dd>{result.statusText}</dd>
              </div>
              <div>
                <dt>取得時刻</dt>
                <dd>{result.generatedAt ? new Date(result.generatedAt).toLocaleString() : "—"}</dd>
              </div>
              <div>
                <dt>path</dt>
                <dd>
                  <code className="tool-url">{result.path ?? endpoint}</code>
                </dd>
              </div>
            </dl>
          </>
        ) : (
          <>
            <header className="tool-card-header">
              <span className="tool-chip">Request Result</span>
              <h2 className={!shouldShowError ? "tool-secondary-heading" : undefined}>
                {shouldShowError ? data?.error?.code ?? "Request error" : "まだ取得していません"}
              </h2>
            </header>
            <p className={shouldShowError ? "tool-error" : "tool-muted"}>
              {shouldShowError
                ? apiErrorMessage ?? error
                : "HTTP ステータスコードを選択して「ステータスを取得」を押してください。"}
            </p>
          </>
        )}
      </article>

      <article className="tool-card tool-direct-card">
        <header className="tool-direct-header">
          <span className="tool-chip">Direct API</span>
          <h2>3xx / 特殊コードは直接開いて確認</h2>
        </header>
        <p className="tool-muted tool-note-wide tool-direct-intro">
          3xx、`407`、`499`、`511` などは frontend の fetch では不安定になりやすいため、API URL を直接ブラウザで開くか curl で確認してください。
        </p>
        <div className="tool-direct-panel">
          <label className="tool-field" htmlFor="http-status-direct-only">
            <span className="tool-field-label">direct API / curl 用ステータスコード</span>
            <select
              id="http-status-direct-only"
              className="tool-input tool-input--select"
              value={directOnlyValue}
              onChange={(event) => setDirectOnlyValue(event.target.value)}
            >
              {groupedDirectOnlyOptions.map(([groupName, entries]) => (
                <optgroup key={groupName} label={groupName}>
                  {entries.map((entry) => (
                    <option key={entry.code} value={String(entry.code)}>
                      {entry.code} {entry.label}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </label>
          <a className="btn btn-sm btn-ghost" href={directOnlyAbsoluteUrl} target="_blank" rel="noreferrer">
            ブラウザで直接開く
          </a>
        </div>
        <div className="tool-direct-url-row">
          <div className="tool-direct-url-copy">
            <code className="tool-url tool-direct-url">{directOnlyAbsoluteUrl}</code>
          </div>
          <button type="button" className="btn btn-sm btn-ghost" onClick={handleCopyDirectUrl}>
            {copiedDirectUrl ? "URLコピー済み ✅" : "URLコピー"}
          </button>
        </div>
        <p className="tool-muted tool-note-wide tool-direct-note">
          `3xx` はブラウザ実装によって見え方が変わることがあり、`407`、`499`、`511` も直接表示が不安定な場合があります。ブラウザで直接開いても本文が表示されない場合は、例えば、次の curl コマンドを使用してください。
        </p>
        <div className="tool-direct-url-row tool-direct-curl-row">
          <div className="tool-direct-url-copy">
            <code className="tool-url tool-direct-url tool-direct-curl-command">{directOnlyCurlCommand}</code>
          </div>
          <button type="button" className="btn btn-sm btn-ghost" onClick={handleCopyCurlCommand}>
            {copiedCurlCommand ? "curl コピー済み ✅" : "curlコピー"}
          </button>
        </div>
      </article>
    </ToolPage>
  );
};
