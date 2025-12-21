import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import request from "supertest";
import { spaAllowlist, normalizeSpaPath } from "../../shared/spa-routes.mjs";
import { createApp } from "../src/app.js";
import {
  resolveClientIp as resolveClientIpService,
  getForbidden as getForbiddenService,
  getHelloMessage as getHelloMessageService,
} from "../src/services/requestInsights.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ensureClientFixture = () => {
  const distDir = path.resolve(__dirname, "../../frontend/dist");
  const indexHtmlPath = path.join(distDir, "index.html");
  if (!fs.existsSync(indexHtmlPath)) {
    fs.mkdirSync(distDir, { recursive: true });
    fs.writeFileSync(
      indexHtmlPath,
      "<!doctype html><html lang=\"ja\"><head><meta charset=\"utf-8\"></head><body><div id=\"root\"></div></body></html>",
      "utf-8",
    );
  }
};

ensureClientFixture();

const { app, clientDir } = createApp();
const describeIfClientBundle = clientDir ? describe : describe.skip;

describe("API v1 utility endpoints", () => {
  test("hello endpoint returns message payload", async () => {
    const response = await request(app).get("/api/v1/hello");

    expect(response.status).toBe(200);
    expect(response.body).toEqual(
      expect.objectContaining({
        title: "Hello, Network World!",
        message: "Just a test page! ✨",
      }),
    );
    expect(new Date(response.body.generatedAt).toString()).not.toBe("Invalid Date");
  });

  test("client-ip endpoint prefers proxy headers", async () => {
    const response = await request(app)
      .get("/api/v1/client-ip")
      .set("X-Forwarded-For", "203.0.113.10, 198.51.100.22")
      .set("X-Client-IP", "198.51.100.99");

    expect(response.status).toBe(200);
    expect(response.body).toEqual(
      expect.objectContaining({
        ip: "203.0.113.10",
        source: "X-Forwarded-For",
      }),
    );
  });

  test("headers endpoint highlights important values", async () => {
    const response = await request(app)
      .get("/api/v1/headers")
      .set("X-Azure-ClientIP", "203.0.113.45")
      .set("User-Agent", "jest");

    expect(response.status).toBe(200);
    const hostRow = response.body.headers.find((row) => row.displayName === "Host");
    expect(hostRow).toBeDefined();
    const azureRow = response.body.headers.find((row) => row.displayName === "X-Azure-ClientIP");
    expect(azureRow.present).toBe(true);
    expect(azureRow.values).toContain("203.0.113.45");
  });

  test("ip-fqdn endpoint combines client and fqdn data", async () => {
    const response = await request(app)
      .get("/api/v1/ip-fqdn?via=combined")
      .set("X-Forwarded-For", "198.51.100.25")
      .set("Host", "combo.example");

    expect(response.status).toBe(200);
    expect(response.body).toEqual(
      expect.objectContaining({
        client: expect.objectContaining({ ip: "198.51.100.25", source: "X-Forwarded-For" }),
        fqdn: expect.objectContaining({ host: "combo.example" }),
        generatedAt: expect.any(String),
      }),
    );
  });

  test("fqdn endpoint reflects host headers", async () => {
    const response = await request(app)
      .get("/api/v1/fqdn?query=123")
      .set("Host", "example.test");

    expect(response.status).toBe(200);
    expect(response.body.url).toContain("example.test");
    expect(response.body.host).toBe("example.test");
  });
});

describe("requestInsights timestamp provider", () => {
  const fixedTimestamp = "2024-01-01T00:00:00.000Z";
  const timestampProvider = () => fixedTimestamp;

  test("resolveClientIp uses injected timestamp", () => {
    const result = resolveClientIpService({ headers: {}, ip: "127.0.0.1" }, { timestampProvider });
    expect(result.resolvedAt).toBe(fixedTimestamp);
  });

  test("getForbidden and getHelloMessage reuse injected timestamp", () => {
    const hello = getHelloMessageService({ timestampProvider });
    const forbidden = getForbiddenService({ originalUrl: "/test" }, { timestampProvider });

    expect(hello.generatedAt).toBe(fixedTimestamp);
    expect(forbidden.generatedAt).toBe(fixedTimestamp);
  });
});

describe("platform routes", () => {
  test("healthz returns ok payload", async () => {
    const response = await request(app).get("/api/healthz");

    expect(response.status).toBe(200);
    expect(response.body).toEqual(
      expect.objectContaining({
        ok: true,
        service: "kof-backend",
      }),
    );
  });

  test("forbidden API responds with 403 status and JSON error payload", async () => {
    const response = await request(app).get("/api/v1/forbidden");

    expect(response.status).toBe(403);
    expect(response.headers["content-type"]).toMatch(/application\/json/);
    expect(response.body).toEqual(
      expect.objectContaining({
        error: expect.objectContaining({
          code: "403 Page",
        }),
      }),
    );
  });
});

describeIfClientBundle("SPA fallback", () => {
  test("known routes return index.html with 200 status", async () => {
    const response = await request(app).get("/tools/ip-fqdn");

    expect(response.status).toBe(200);
    expect(response.headers["content-type"]).toMatch(/text\/html/);
  });

  test("forbidden SPA route returns index.html with 403 status", async () => {
    const response = await request(app).get("/tools/forbidden");

    expect(response.status).toBe(403);
    expect(response.headers["content-type"]).toMatch(/text\/html/);
  });

  test("unknown routes return index.html with 404 status", async () => {
    const response = await request(app).get("/not-a-real-route");

    expect(response.status).toBe(404);
    expect(response.headers["content-type"]).toMatch(/text\/html/);
  });
});

describe("SPA route allowlist maintenance", () => {
  const appSourcePath = path.resolve(__dirname, "../../frontend/src/App.jsx");

  test("every React Router path is present in spaAllowlist", () => {
    const appSource = fs.readFileSync(appSourcePath, "utf-8");
    const routeRegex = /<Route\s+path="([^"]+)"/g;
    const declaredRoutes = new Set();

    let match;
    while ((match = routeRegex.exec(appSource))) {
      const rawPath = match[1];
      if (!rawPath || rawPath === "*" || rawPath.startsWith("/api")) continue;
      declaredRoutes.add(normalizeSpaPath(rawPath));
    }

    expect(declaredRoutes.size).toBeGreaterThan(0);

    const missingInAllowlist = Array.from(declaredRoutes).filter((route) => !spaAllowlist.has(route));
    expect(missingInAllowlist).toEqual([]);

    const staleAllowlistEntries = Array.from(spaAllowlist).filter((route) => !declaredRoutes.has(route));
    expect(staleAllowlistEntries).toEqual([]);
  });
});
