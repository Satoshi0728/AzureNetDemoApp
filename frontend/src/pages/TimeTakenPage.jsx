import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ToolPage } from "../components/ToolPage.jsx";
import { useApiResource } from "../hooks/useApiResource.js";

const DEFAULT_SECONDS = "2";
const LOADING_TICK_MS = 100;

const buildEndpoint = (secondsValue) => `/api/v1/timetaken?seconds=${encodeURIComponent(secondsValue)}`;

const formatTimestamp = (value) => {
  if (!value) return "—";
  return new Date(value).toLocaleString();
};

const formatDuration = (durationMs) => `${(Math.max(durationMs, 0) / 1000).toFixed(1)}s`;
const formatRemainingSeconds = (durationMs) => `${Math.ceil(Math.max(durationMs, 0) / 1000)}s`;

export const TimeTakenPage = () => {
  const [inputValue, setInputValue] = useState(DEFAULT_SECONDS);
  const [endpoint, setEndpoint] = useState("");
  const [submittedSeconds, setSubmittedSeconds] = useState("");
  const [loadingStartedAtMs, setLoadingStartedAtMs] = useState(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [wasCancelled, setWasCancelled] = useState(false);
  const { data, status, error, reload, cancel } = useApiResource(endpoint, { immediate: false });

  const isLoading = status === "loading";
  const result = status === "success" ? data : null;
  const errorMessage = data?.error?.message ?? error;
  const isCancelled = !isLoading && !result && !errorMessage && wasCancelled;
  const waitingSeconds = Number(submittedSeconds || inputValue || DEFAULT_SECONDS);
  const requestedDelayMs = Number.isFinite(waitingSeconds) && waitingSeconds >= 0 ? waitingSeconds * 1000 : 0;
  const loadingDuration =
    Number.isFinite(waitingSeconds) && waitingSeconds > 0 ? `${waitingSeconds}s` : "0.8s";
  const remainingMs = Math.max(requestedDelayMs - elapsedMs, 0);

  useEffect(() => {
    if (!isLoading || loadingStartedAtMs == null) {
      if (!isLoading) {
        setElapsedMs(0);
      }
      return undefined;
    }

    setElapsedMs(Math.max(Date.now() - loadingStartedAtMs, 0));
    const intervalId = window.setInterval(() => {
      setElapsedMs(Math.max(Date.now() - loadingStartedAtMs, 0));
    }, LOADING_TICK_MS);

    return () => window.clearInterval(intervalId);
  }, [isLoading, loadingStartedAtMs]);

  useEffect(() => {
    if (!endpoint) return;
    reload();
  }, [endpoint, reload]);

  const handleSubmit = (event) => {
    event.preventDefault();
    const nextSeconds = inputValue.trim();
    const nextEndpoint = buildEndpoint(nextSeconds);
    const startedAtMs = Date.now();
    setWasCancelled(false);
    setSubmittedSeconds(nextSeconds);
    setLoadingStartedAtMs(startedAtMs);
    setElapsedMs(0);

    if (nextEndpoint === endpoint) {
      reload();
      return;
    }

    setEndpoint(nextEndpoint);
  };

  const handleCancel = () => {
    if (!isLoading) return;
    cancel();
    setWasCancelled(true);
    setLoadingStartedAtMs(null);
    setElapsedMs(0);
  };

  return (
    <ToolPage
      title="遅延レスポンス"
      description="指定した秒数だけ待機したあとに応答を返す API をブラウザから試せます。負荷テストやタイムアウト検証の確認に便利です。"
      actions={
        <div className="tool-button-bar">
          <Link className="btn btn-sm btn-ghost" to="/tools/http-headers">
            HTTP ヘッダーへ
          </Link>
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
        <form className="tool-form" onSubmit={handleSubmit}>
          <label className="tool-field" htmlFor="time-taken-seconds">
            <span className="tool-field-label">遅延秒数</span>
            <input
              id="time-taken-seconds"
              className="tool-input"
              type="number"
              min="0"
              max="300"
              step="1"
              value={inputValue}
              onChange={(event) => setInputValue(event.target.value)}
            />
          </label>
          <div className="tool-button-bar">
            <button type="submit" className="btn btn-sm" disabled={isLoading}>
              {isLoading ? "処理中..." : "送信"}
            </button>
            {isLoading ? (
              <button type="button" className="btn btn-sm btn-ghost" onClick={handleCancel}>
                中断
              </button>
            ) : null}
          </div>
        </form>
        <p className="tool-muted">UI から指定できるのは整数秒のみです。小数秒は API を直接叩いて下さい。</p>
        <dl className="tool-meta">
          <div>
            <dt>入力値</dt>
            <dd>{submittedSeconds || "—"}</dd>
          </div>
          <div>
            <dt>対象 API</dt>
            <dd>
              <code className="tool-url">{endpoint || "/api/v1/timetaken?seconds=..."}</code>
            </dd>
          </div>
        </dl>
      </article>

      <article className="tool-card">
        {isLoading ? (
          <>
            <header className="tool-card-header tool-card-header--center">
              <h2 className="tool-loading-title-only">待機中</h2>
            </header>
            <p className="tool-muted tool-loading-note">
              指定した遅延が終わるまで待っています。残り時間は目安です。
            </p>
            <dl className="tool-meta tool-loading-status" aria-live="polite">
              <div>
                <dt>requested delay</dt>
                <dd>{formatDuration(requestedDelayMs)}</dd>
              </div>
              <div>
                <dt>remaining</dt>
                <dd>{formatRemainingSeconds(remainingMs)}</dd>
              </div>
              <div>
                <dt>path</dt>
                <dd>
                  <code className="tool-url">{endpoint || "/api/v1/timetaken?seconds=..."}</code>
                </dd>
              </div>
            </dl>
            <section
              className="tool-loading-runway"
              aria-hidden="true"
              style={{ "--turtle-duration": loadingDuration }}
            >
              <div className="tool-loading-runway__track">
                <span className="tool-loading-runway__lane" />
                <span className="tool-loading-shadow" />
                <span className="tool-loading-grass tool-loading-grass--left" />
                <span className="tool-loading-grass tool-loading-grass--right" />
                <span className="tool-loading-turtle">🐢</span>
              </div>
            </section>
          </>
        ) : result ? (
          <>
            <header className="tool-card-header">
              <span className="tool-chip">Delayed Response</span>
              <h2>{result.requestedSeconds} seconds</h2>
            </header>
            <dl className="tool-meta" aria-live="polite">
              <div>
                <dt>requestedSeconds</dt>
                <dd>{result.requestedSeconds}</dd>
              </div>
              <div>
                <dt>delayMs</dt>
                <dd>{result.delayMs}</dd>
              </div>
              <div>
                <dt>startedAt</dt>
                <dd>{formatTimestamp(result.startedAt)}</dd>
              </div>
              <div>
                <dt>completedAt</dt>
                <dd>{formatTimestamp(result.completedAt)}</dd>
              </div>
              <div>
                <dt>path</dt>
                <dd>
                  <code className="tool-url">{result.path ?? "—"}</code>
                </dd>
              </div>
              <div>
                <dt>server.hostname</dt>
                <dd>{result.server?.hostname ?? "—"}</dd>
              </div>
            </dl>
          </>
        ) : (
          <>
            <header className="tool-card-header">
              <span className="tool-chip">Request Result</span>
              <h2 className={errorMessage ? undefined : "tool-secondary-heading"}>
                {errorMessage ? "Request error" : isCancelled ? "リクエストを中断しました" : "まだ実行していません"}
              </h2>
            </header>
            <p className={errorMessage ? "tool-error" : "tool-muted"}>
              {errorMessage ??
                (isCancelled
                  ? "クライアント側で通信を中断しました。必要であれば、もう一度「送信」を押して再実行してください。"
                  : "遅延秒数を入力して「送信」を押してください。")}
            </p>
          </>
        )}
      </article>
    </ToolPage>
  );
};
