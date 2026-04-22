import { describe, expect, test, beforeEach, afterEach, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HelloPage } from "../HelloPage.jsx";
import { HeadersPage } from "../HeadersPage.jsx";
import { IpFqdnPage, __resetHistoryForTest } from "../IpFqdnPage.jsx";
import { HttpStatusPage } from "../HttpStatus.jsx";
import { TimeTakenPage } from "../TimeTakenPage.jsx";
import {
  httpStatusCatalog,
  HTTP_STATUS_BODY_BEHAVIOR,
  HTTP_STATUS_VISIBILITY,
  isBodylessHttpStatus,
} from "../../../../shared/http-status-catalog.mjs";
import { supportedHttpStatusOptions, directOnlyHttpStatusOptions } from "../../../../shared/http-status-options.mjs";

vi.mock("../../utils/clipboard.js", () => ({
  copyToClipboard: vi.fn().mockResolvedValue(true),
}));

const mockFetch = (payload, options = {}) => {
  const { ok = true, status = ok ? 200 : 500, delay = 0 } = options;
  return vi.fn(() =>
    Promise.resolve({
      ok,
      status,
      headers: {
        get: (name) => (name && name.toLowerCase() === "content-type" ? "application/json" : null),
      },
      json: () =>
        new Promise((resolve) => {
          setTimeout(() => resolve(payload), delay);
        }),
    }),
  );
};

describe("Utility pages", () => {
  beforeEach(() => {
    __resetHistoryForTest();
  });
  afterEach(() => {
    vi.restoreAllMocks();
    __resetHistoryForTest();
  });

  test("HelloPage displays greeting from API", async () => {
    global.fetch = mockFetch({
      title: "Hello, Network World!",
      message: "Just a test page! ✨",
      generatedAt: "2025-01-10T12:34:56.000Z",
    });

    render(
      <MemoryRouter>
        <HelloPage />
      </MemoryRouter>,
    );

    expect(await screen.findByText("Hello, Network World!")).toBeInTheDocument();
    expect(screen.getByText("Just a test page! ✨")).toBeInTheDocument();
  });

  test("HeadersPage lists received headers", async () => {
    global.fetch = mockFetch({
      receivedAt: "2025-01-10T12:34:56.000Z",
      headers: [
        { displayName: "X-Azure-ClientIP", values: ["203.0.113.22"], important: true, present: true },
        { displayName: "User-Agent", values: ["vitest"], important: false, present: true },
      ],
    });

    render(
      <MemoryRouter>
        <HeadersPage />
      </MemoryRouter>,
    );

    expect(await screen.findByText("X-Azure-ClientIP")).toBeInTheDocument();
    expect(screen.getByText("203.0.113.22")).toBeInTheDocument();
    expect(screen.getByText("vitest")).toBeInTheDocument();
  });

  test("IpFqdnPage shows combined payload", async () => {
    const localeSpy = vi.spyOn(Date.prototype, "toLocaleString").mockReturnValue("mocked-date");
    global.fetch = mockFetch({
      client: { ip: "198.51.100.55", source: "X-Forwarded-For", resolvedAt: "2025-01-11T10:00:00.000Z" },
      fqdn: { host: "combo.local", url: "https://combo.local/tools/ip-fqdn", inspectedAt: "2025-01-11T10:00:01.000Z" },
      generatedAt: "2025-01-11T10:00:01.500Z",
    });

    try {
      render(
        <MemoryRouter>
          <IpFqdnPage />
        </MemoryRouter>,
      );

      expect(await screen.findByRole("heading", { level: 2, name: "198.51.100.55" })).toBeInTheDocument();
      expect(await screen.findByRole("heading", { level: 2, name: "combo.local" })).toBeInTheDocument();
      expect(screen.getByText("https://combo.local/tools/ip-fqdn")).toBeInTheDocument();
      const timeLabels = screen.getAllByText("取得時刻");
      expect(timeLabels[0]).toBeInTheDocument();
      const timestamps = screen.getAllByText("mocked-date");
      expect(timestamps[0]).toBeInTheDocument();
      await waitFor(() => expect(global.fetch).toHaveBeenCalledWith("/api/v1/ip-fqdn", expect.any(Object)));
    } finally {
      localeSpy.mockRestore();
    }
  });

  test("HttpStatusPage fetches and displays a requested status payload", async () => {
    const user = userEvent.setup();
    global.fetch = vi.fn((url) =>
      Promise.resolve({
        ok: false,
        status: 404,
        headers: {
          get: (name) => (name && name.toLowerCase() === "content-type" ? "application/json" : null),
        },
        json: async () => ({
          statusCode: 404,
          statusText: "Not Found",
          description: "The requested resource could not be found on this server.",
          generatedAt: "2025-01-12T09:10:11.000Z",
          path: String(url),
        }),
      }),
    );

    render(
      <MemoryRouter>
        <HttpStatusPage />
      </MemoryRouter>,
    );

    const input = screen.getByLabelText("HTTP ステータスコードを選択");
    await user.selectOptions(input, "404");
    await user.click(screen.getByRole("button", { name: "ステータスを取得" }));

    expect(await screen.findByRole("heading", { level: 2, name: "404 Not Found" })).toBeInTheDocument();
    expect(screen.getByText("The requested resource could not be found on this server.")).toBeInTheDocument();
    expect(screen.getAllByText("404").length).toBeGreaterThan(0);
    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith("/api/v1/httpstatus?status=404", expect.any(Object)));
  });

  test("HttpStatusPage limits selection to supported status codes", async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        headers: {
          get: (name) => (name && name.toLowerCase() === "content-type" ? "application/json" : null),
        },
        json: async () => ({
          statusCode: 499,
          statusText: "Client Closed Request",
          description: "The client closed the connection before the server could complete the response.",
          generatedAt: "2025-01-12T09:10:11.000Z",
          path: "/api/v1/httpstatus?status=499",
        }),
      }),
    );

    render(
      <MemoryRouter>
        <HttpStatusPage />
      </MemoryRouter>,
    );

    const select = screen.getByLabelText("HTTP ステータスコードを選択");
    const directOnlySelect = screen.getByLabelText("direct API / curl 用ステータスコード");
    expect(select).toBeInTheDocument();
    expect(directOnlySelect).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.getByText("この一覧はブラウザ fetch で安定して扱えるステータスコードだけに絞っています。")).toBeInTheDocument();
    expect(within(select).getByRole("option", { name: "204 No Content" })).toBeInTheDocument();
    expect(within(select).getByRole("option", { name: "205 Reset Content" })).toBeInTheDocument();
    expect(within(select).queryByRole("option", { name: "303 See Other" })).not.toBeInTheDocument();
    expect(within(select).queryByRole("option", { name: "407 Proxy Authentication Required" })).not.toBeInTheDocument();
    expect(within(select).queryByRole("option", { name: "499 Client Closed Request" })).not.toBeInTheDocument();
    expect(within(select).queryByRole("option", { name: "511 Network Authentication Required" })).not.toBeInTheDocument();
    expect(screen.getByText("3xx / 特殊コードは直接開いて確認")).toBeInTheDocument();
    expect(within(directOnlySelect).queryByRole("option", { name: "100 Continue" })).not.toBeInTheDocument();
    expect(within(directOnlySelect).getByRole("option", { name: "303 See Other" })).toBeInTheDocument();
    expect(within(directOnlySelect).getByRole("option", { name: "407 Proxy Authentication Required" })).toBeInTheDocument();
    expect(within(directOnlySelect).getByRole("option", { name: "499 Client Closed Request" })).toBeInTheDocument();
    expect(within(directOnlySelect).getByRole("option", { name: "511 Network Authentication Required" })).toBeInTheDocument();
    const expectedDirectUrl = `${window.location.origin}/api/v1/httpstatus?status=303`;
    const expectedCurlCommand = `curl -i '${expectedDirectUrl}'`;
    expect(screen.getByRole("link", { name: "ブラウザで直接開く" })).toHaveAttribute(
      "href",
      expectedDirectUrl,
    );
    expect(screen.getByRole("button", { name: "URLコピー" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "curlコピー" })).toBeInTheDocument();
    expect(screen.getByText(expectedDirectUrl)).toBeInTheDocument();
    expect(screen.getByText(expectedCurlCommand)).toBeInTheDocument();
  });

  test.each([
    ["204", "No Content", "The request succeeded and there is no response body to return."],
    ["205", "Reset Content", "The request succeeded and the client should reset the document view."],
  ])("HttpStatusPage displays a bodyless success for %s", async (code, label, description) => {
    const localeSpy = vi.spyOn(Date.prototype, "toLocaleString").mockReturnValue("bodyless-generated-at");
    const user = userEvent.setup();
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        status: Number(code),
        headers: {
          get: (name) => {
            const normalized = name && name.toLowerCase();
            if (normalized === "content-length") return "0";
            if (normalized === "content-type") return null;
            if (normalized === "x-generated-at") return "2025-01-12T09:10:11.000Z";
            if (normalized === "x-status-text") return label;
            return null;
          },
        },
        json: async () => {
          throw new Error("json should not be called for bodyless statuses");
        },
      }),
    );

    render(
      <MemoryRouter>
        <HttpStatusPage />
      </MemoryRouter>,
    );

    const input = screen.getByLabelText("HTTP ステータスコードを選択");
    await user.selectOptions(input, code);
    await user.click(screen.getByRole("button", { name: "ステータスを取得" }));

    try {
      expect(await screen.findByRole("heading", { level: 2, name: `${code} ${label}` })).toBeInTheDocument();
      expect(screen.getByText(description)).toBeInTheDocument();
      expect(screen.getByText("このステータスは HTTP 仕様上レスポンス本文を返さないため、共有カタログの説明を表示しています。")).toBeInTheDocument();
      expect(screen.getByText("bodyless-generated-at")).toBeInTheDocument();
      expect(screen.queryByText("まだ取得していません")).not.toBeInTheDocument();
      expect(screen.getAllByText("/api/v1/httpstatus?status=" + code).length).toBeGreaterThan(0);
    } finally {
      localeSpy.mockRestore();
    }
  });

  test("TimeTakenPage shows waiting state while the delayed response is in flight", async () => {
    const user = userEvent.setup();
    let resolveFetch;

    global.fetch = vi.fn(
      () =>
        new Promise((resolve) => {
          resolveFetch = () =>
            resolve({
              ok: true,
              status: 200,
              headers: {
                get: (name) => (name && name.toLowerCase() === "content-type" ? "application/json" : null),
              },
              json: async () => ({
                requestedSeconds: 2,
                delayMs: 2000,
                startedAt: "2025-01-12T09:10:11.000Z",
                completedAt: "2025-01-12T09:10:13.000Z",
                path: "/api/v1/timetaken?seconds=2",
                server: {
                  hostname: "test-host",
                },
              }),
            });
        }),
    );

    render(
      <MemoryRouter>
        <TimeTakenPage />
      </MemoryRouter>,
    );

    expect(screen.queryByRole("button", { name: "中断" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "送信" }));

    expect(await screen.findByRole("heading", { level: 2, name: "待機中" })).toBeInTheDocument();
    expect(screen.getByText("🐢")).toBeInTheDocument();
    expect(screen.getByText(/requested delay/i)).toBeInTheDocument();
    expect(screen.getByText(/remaining/i)).toBeInTheDocument();
    expect(screen.queryByText("まだ実行していません")).not.toBeInTheDocument();

    resolveFetch();

    expect(await screen.findByRole("heading", { level: 2, name: "2 seconds" })).toBeInTheDocument();
  });

  test("TimeTakenPage cancels the in-flight request from the form", async () => {
    const user = userEvent.setup();
    let requestSignal;

    global.fetch = vi.fn((_url, options) => {
      requestSignal = options?.signal ?? null;
      return new Promise((_, reject) => {
        requestSignal?.addEventListener("abort", () => {
          const abortError = new Error("The operation was aborted.");
          abortError.name = "AbortError";
          reject(abortError);
        });
      });
    });

    render(
      <MemoryRouter>
        <TimeTakenPage />
      </MemoryRouter>,
    );

    expect(screen.queryByRole("button", { name: "中断" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "送信" }));

    expect(await screen.findByRole("heading", { level: 2, name: "待機中" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "中断" })).toBeEnabled();

    await user.click(screen.getByRole("button", { name: "中断" }));

    await waitFor(() => expect(requestSignal?.aborted).toBe(true));
    expect(await screen.findByRole("heading", { level: 2, name: "リクエストを中断しました" })).toBeInTheDocument();
    expect(
      screen.getByText("クライアント側で通信を中断しました。必要であれば、もう一度「送信」を押して再実行してください。"),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "送信" })).toBeEnabled();
    expect(screen.queryByRole("button", { name: "中断" })).not.toBeInTheDocument();
    expect(screen.queryByText("🐢")).not.toBeInTheDocument();
  });
});

describe("HTTP status catalog consistency", () => {
  test("shared catalog exposes bodyless status behavior", () => {
    expect(httpStatusCatalog.find((entry) => entry.code === 204)?.bodyBehavior).toBe(HTTP_STATUS_BODY_BEHAVIOR.BODYLESS);
    expect(httpStatusCatalog.find((entry) => entry.code === 205)?.bodyBehavior).toBe(HTTP_STATUS_BODY_BEHAVIOR.BODYLESS);
    expect(httpStatusCatalog.find((entry) => entry.code === 304)?.bodyBehavior).toBe(HTTP_STATUS_BODY_BEHAVIOR.BODYLESS);
    expect(httpStatusCatalog.find((entry) => entry.code === 200)?.bodyBehavior).toBe(HTTP_STATUS_BODY_BEHAVIOR.JSON);
    expect(isBodylessHttpStatus(204)).toBe(true);
    expect(isBodylessHttpStatus(205)).toBe(true);
    expect(isBodylessHttpStatus(304)).toBe(true);
    expect(isBodylessHttpStatus(200)).toBe(false);
  });

  test("shared option lists match the surfaced catalog entries without overlap", () => {
    const supportedCodes = supportedHttpStatusOptions.map((entry) => entry.code);
    const directOnlyCodes = directOnlyHttpStatusOptions.map((entry) => entry.code);
    const allSurfacedCodes = [...supportedCodes, ...directOnlyCodes];
    const uniqueSurfacedCodes = new Set(allSurfacedCodes);
    const catalogSurfacedEntries = httpStatusCatalog.filter((entry) => entry.visibility !== HTTP_STATUS_VISIBILITY.HIDDEN);

    expect(uniqueSurfacedCodes.size).toBe(allSurfacedCodes.length);
    expect(supportedCodes).toEqual(
      httpStatusCatalog
        .filter((entry) => entry.visibility === HTTP_STATUS_VISIBILITY.SUPPORTED)
        .map((entry) => entry.code),
    );
    expect(directOnlyCodes).toEqual(
      httpStatusCatalog
        .filter((entry) => entry.visibility === HTTP_STATUS_VISIBILITY.DIRECT_ONLY)
        .map((entry) => entry.code),
    );
    expect([...allSurfacedCodes].sort((a, b) => a - b)).toEqual(
      catalogSurfacedEntries.map((entry) => entry.code).sort((a, b) => a - b),
    );

    [...supportedHttpStatusOptions, ...directOnlyHttpStatusOptions].forEach((option) => {
      const catalogEntry = httpStatusCatalog.find((entry) => entry.code === option.code);
      expect(catalogEntry).toBeDefined();
      expect(option.label).toBe(catalogEntry.label);
      expect(option.group).toBe(catalogEntry.group);
      expect(catalogEntry.description).toEqual(expect.any(String));
    });
  });
});

describe("IpFqdnPage history tracking", () => {
  beforeEach(() => {
    __resetHistoryForTest();
  });
  afterEach(() => {
    vi.restoreAllMocks();
    __resetHistoryForTest();
  });

  test("adds entry to history when data is successfully fetched", async () => {
    const localeSpy = vi.spyOn(Date.prototype, "toLocaleString").mockReturnValue("mocked-date");
    global.fetch = mockFetch({
      client: { ip: "198.51.100.55", source: "X-Forwarded-For", resolvedAt: "2025-01-11T10:00:00.000Z" },
      fqdn: { host: "test.local", url: "https://test.local/tools/ip-fqdn", inspectedAt: "2025-01-11T10:00:01.000Z" },
      generatedAt: "2025-01-11T10:00:01.500Z",
    });

    try {
      render(
        <MemoryRouter>
          <IpFqdnPage />
        </MemoryRouter>,
      );

      // Wait for initial data to load
      await screen.findByRole("heading", { level: 2, name: "198.51.100.55" });

      // Check that history section shows data
      expect(screen.getByText("取得履歴")).toBeInTheDocument();

      // Check that the table has the history data
      const historyTable = await screen.findByLabelText("取得履歴");
      expect(historyTable).toBeInTheDocument();
      expect(historyTable.textContent).toContain("198.51.100.55");
      expect(historyTable.textContent).toContain("X-Forwarded-For");
      expect(historyTable.textContent).toContain("test.local");
    } finally {
      localeSpy.mockRestore();
    }
  });

  test("displays empty history message when no data has been fetched", async () => {
    global.fetch = mockFetch({
      client: {},
      fqdn: {},
      generatedAt: "2025-01-11T10:00:01.500Z",
    });

    render(
      <MemoryRouter>
        <IpFqdnPage />
      </MemoryRouter>,
    );

    // Wait for component to mount
    await waitFor(() => expect(global.fetch).toHaveBeenCalled());

    // Should still show history heading
    expect(screen.getByText("取得履歴")).toBeInTheDocument();
  });

  test("limits history to HISTORY_LIMIT entries (5 max)", async () => {
    const localeSpy = vi.spyOn(Date.prototype, "toLocaleString").mockReturnValue("mocked-date");
    const user = userEvent.setup();

    global.fetch = mockFetch({
      client: { ip: "192.168.1.1", source: "X-Forwarded-For" },
      fqdn: { host: "host1.local", url: "https://host1.local" },
      generatedAt: "2025-01-11T10:00:01.000Z",
    });

    try {
      render(
        <MemoryRouter>
          <IpFqdnPage />
        </MemoryRouter>,
      );

      // Wait for initial load
      await screen.findByRole("heading", { level: 2, name: "192.168.1.1" });

      // Trigger 5 additional reloads (reloads 2-6) to exceed HISTORY_LIMIT (total 6 entries)
      for (let i = 2; i <= 6; i++) {
        global.fetch = mockFetch({
          client: { ip: `192.168.1.${i}`, source: "X-Forwarded-For" },
          fqdn: { host: `host${i}.local`, url: `https://host${i}.local` },
          generatedAt: `2025-01-11T10:00:0${i}.000Z`,
        });

        const reloadButton = screen.getByRole("button", { name: "情報を再取得" });
        await user.click(reloadButton);
        await screen.findByRole("heading", { level: 2, name: `192.168.1.${i}` });
      }

      // After 6 fetches, should only have 5 entries (HISTORY_LIMIT)
      // The table should show entries #1 through #5
      const historyTable = await screen.findByLabelText("取得履歴");
      expect(historyTable).toBeInTheDocument();
      
      // Count the number of table rows in tbody (excluding header)
      const tbody = historyTable.querySelector("tbody");
      const rows = tbody?.querySelectorAll("tr") ?? [];
      expect(rows.length).toBe(5); // Should have exactly 5 entries
      
      await waitFor(() => {
        // The oldest entry (host1.local) should be gone from history table
        expect(historyTable.textContent).not.toContain("host1.local");
        // The latest entries (2-6) should be in history
        expect(historyTable.textContent).toContain("host2.local");
        expect(historyTable.textContent).toContain("host6.local");
      });
    } finally {
      localeSpy.mockRestore();
    }
  });

  test("updates history when reload button is clicked", async () => {
    const localeSpy = vi.spyOn(Date.prototype, "toLocaleString").mockReturnValue("mocked-date");
    const user = userEvent.setup();

    global.fetch = mockFetch({
      client: { ip: "10.0.0.1", source: "remoteAddr" },
      fqdn: { host: "initial.local", url: "https://initial.local" },
      generatedAt: "2025-01-11T10:00:00.000Z",
    });

    try {
      render(
        <MemoryRouter>
          <IpFqdnPage />
        </MemoryRouter>,
      );

      // Wait for initial load
      await screen.findByRole("heading", { level: 2, name: "10.0.0.1" });
      
      const historyTable = await screen.findByLabelText("取得履歴");
      expect(historyTable.textContent).toContain("initial.local");

      // Mock a different response for reload
      global.fetch = mockFetch({
        client: { ip: "10.0.0.2", source: "X-Real-IP" },
        fqdn: { host: "updated.local", url: "https://updated.local" },
        generatedAt: "2025-01-11T10:00:05.000Z",
      });

      // Click reload button
      const reloadButton = screen.getByRole("button", { name: "情報を再取得" });
      await user.click(reloadButton);

      // Wait for new data
      await screen.findByRole("heading", { level: 2, name: "10.0.0.2" });

      // Check history table has both entries
      await waitFor(() => {
        const refreshedHistoryTable = screen.getByLabelText("取得履歴");
        expect(refreshedHistoryTable.textContent).toContain("10.0.0.1");
        expect(refreshedHistoryTable.textContent).toContain("10.0.0.2");
        expect(refreshedHistoryTable.textContent).toContain("initial.local");
        expect(refreshedHistoryTable.textContent).toContain("updated.local");
      });
    } finally {
      localeSpy.mockRestore();
    }
  });

  test("formats timestamps correctly in history table", async () => {
    const mockDate = new Date("2025-01-11T15:30:45.000Z");
    const localeSpy = vi.spyOn(Date.prototype, "toLocaleString").mockReturnValue("2025-01-11 15:30:45");

    global.fetch = mockFetch({
      client: { ip: "172.16.0.1", source: "remoteAddr" },
      fqdn: { host: "time.test", url: "https://time.test" },
      generatedAt: mockDate.toISOString(),
    });

    try {
      render(
        <MemoryRouter>
          <IpFqdnPage />
        </MemoryRouter>,
      );

      await screen.findByText("172.16.0.1");

      // Check that the timestamp is formatted
      const timestamps = screen.getAllByText("2025-01-11 15:30:45");
      expect(timestamps.length).toBeGreaterThan(0);
    } finally {
      localeSpy.mockRestore();
    }
  });

  test("shows correct source values in history", async () => {
    const localeSpy = vi.spyOn(Date.prototype, "toLocaleString").mockReturnValue("mocked-date");

    global.fetch = mockFetch({
      client: { ip: "203.0.113.5", source: "X-Azure-ClientIP" },
      fqdn: { host: "azure.test", url: "https://azure.test" },
      generatedAt: "2025-01-11T10:00:00.000Z",
    });

    try {
      render(
        <MemoryRouter>
          <IpFqdnPage />
        </MemoryRouter>,
      );

      await screen.findByRole("heading", { level: 2, name: "203.0.113.5" });

      // Check that X-Azure-ClientIP appears in the history table
      const historyTable = await screen.findByLabelText("取得履歴");
      expect(historyTable.textContent).toContain("X-Azure-ClientIP");
    } finally {
      localeSpy.mockRestore();
    }
  });

  test("handles null or missing values in history entries", async () => {
    const localeSpy = vi.spyOn(Date.prototype, "toLocaleString").mockReturnValue("mocked-date");

    global.fetch = mockFetch({
      client: { ip: null, source: null },
      fqdn: { host: null, url: null },
      generatedAt: "2025-01-11T10:00:00.000Z",
    });

    try {
      render(
        <MemoryRouter>
          <IpFqdnPage />
        </MemoryRouter>,
      );

      // Wait for fetch to complete
      await waitFor(() => expect(global.fetch).toHaveBeenCalled());

      // Check that history shows placeholder values for null data
      const historyTable = await screen.findByLabelText("取得履歴");
      expect(historyTable.textContent).toContain("#1");
      
      // Should show "—" for missing values
      const dashSymbols = screen.getAllByText("—");
      expect(dashSymbols.length).toBeGreaterThan(0);
    } finally {
      localeSpy.mockRestore();
    }
  });
});
