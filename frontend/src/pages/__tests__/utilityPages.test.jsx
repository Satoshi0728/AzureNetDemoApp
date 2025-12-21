import { describe, expect, test, beforeEach, afterEach, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HelloPage } from "../HelloPage.jsx";
import { HeadersPage } from "../HeadersPage.jsx";
import { ForbiddenPage } from "../ForbiddenPage.jsx";
import { IpFqdnPage, __resetHistoryForTest } from "../IpFqdnPage.jsx";

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

  test("ForbiddenPage displays 403 payload", async () => {
    global.fetch = mockFetch(
      {
        error: { code: "403 Page", message: "Access to this resource is forbidden." },
        generatedAt: "2025-01-10T12:34:56.000Z",
        path: "/api/v1/forbidden",
      },
      { ok: false, status: 403 },
    );

    render(
      <MemoryRouter>
        <ForbiddenPage />
      </MemoryRouter>,
    );

    expect(await screen.findByText("403 Page")).toBeInTheDocument();
    expect(screen.getByText("Access to this resource is forbidden.")).toBeInTheDocument();
    expect(screen.getByText("/api/v1/forbidden")).toBeInTheDocument();
    expect(screen.getByText("403")).toBeInTheDocument();
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
      const historyTable = screen.getByLabelText("取得履歴");
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
      expect(historyTable.textContent).toContain("10.0.0.1");
      expect(historyTable.textContent).toContain("10.0.0.2");
      expect(historyTable.textContent).toContain("initial.local");
      expect(historyTable.textContent).toContain("updated.local");
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
