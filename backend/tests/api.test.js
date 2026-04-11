import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import request from "supertest";
import {
  findHttpStatusCatalogEntry,
  HTTP_STATUS_BODY_BEHAVIOR,
  isBodylessHttpStatus,
} from "../../shared/http-status-catalog.mjs";
import { supportedHttpStatusOptions, directOnlyHttpStatusOptions } from "../../shared/http-status-options.mjs";
import { spaAllowlist, normalizeSpaPath } from "../../shared/spa-routes.mjs";
import { createApp } from "../src/app.js";
import {
  resolveClientIp as resolveClientIpService,
  getHelloMessage as getHelloMessageService,
  getHttpStatus as getHttpStatusService,
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

  test("httpstatus endpoint returns metadata for 400", async () => {
    const response = await request(app).get("/api/v1/httpstatus?status=400");

    expect(response.status).toBe(400);
    expect(response.headers["content-type"]).toMatch(/application\/json/);
    expect(response.body).toEqual(
      expect.objectContaining({
        statusCode: 400,
        statusText: "Bad Request",
        description: expect.any(String),
      }),
    );
  });

  test("httpstatus endpoint returns metadata for 403", async () => {
    const response = await request(app).get("/api/v1/httpstatus?status=403");

    expect(response.status).toBe(403);
    expect(response.body).toEqual(
      expect.objectContaining({
        statusCode: 403,
        statusText: "Forbidden",
        description: expect.any(String),
      }),
    );
  });

  test("httpstatus endpoint returns metadata for 404", async () => {
    const response = await request(app).get("/api/v1/httpstatus?status=404");

    expect(response.status).toBe(404);
    expect(response.body).toEqual(
      expect.objectContaining({
        statusCode: 404,
        statusText: "Not Found",
        description: expect.any(String),
      }),
    );
  });

  test("httpstatus endpoint returns metadata for 500", async () => {
    const response = await request(app).get("/api/v1/httpstatus?status=500");

    expect(response.status).toBe(500);
    expect(response.body).toEqual(
      expect.objectContaining({
        statusCode: 500,
        statusText: "Internal Server Error",
        description: expect.any(String),
      }),
    );
  });

  test("httpstatus endpoint returns unknown metadata for 222", async () => {
    const response = await request(app).get("/api/v1/httpstatus?status=222");

    expect(response.status).toBe(222);
    expect(response.body).toEqual(
      expect.objectContaining({
        statusCode: 222,
        statusText: "Unknown Status",
        description: expect.stringContaining("HTTP 222"),
      }),
    );
  });

  test.each([
    ["204", "No Content"],
    ["205", "Reset Content"],
    ["304", "Not Modified"],
  ])("httpstatus endpoint returns a bodyless response for %s", async (code, statusText) => {
    const response = await request(app).get(`/api/v1/httpstatus?status=${code}`);

    expect(response.status).toBe(Number(code));
    expect(response.headers["content-type"]).toBeUndefined();
    expect(response.headers["x-generated-at"]).toEqual(expect.any(String));
    expect(response.headers["x-status-text"]).toBe(statusText);
    expect(response.text).toBe("");
  });

  test("httpstatus endpoint returns 400 when status is missing", async () => {
    const response = await request(app).get("/api/v1/httpstatus");

    expect(response.status).toBe(400);
    expect(response.body).toEqual(
      expect.objectContaining({
        error: expect.objectContaining({
          code: "Missing status parameter",
          message: 'Query parameter "status" is required.',
        }),
      }),
    );
  });

  test("httpstatus endpoint returns 400 when status is not numeric", async () => {
    const response = await request(app).get("/api/v1/httpstatus?status=abc");

    expect(response.status).toBe(400);
    expect(response.body).toEqual(
      expect.objectContaining({
        error: expect.objectContaining({
          code: "Invalid status parameter",
          message: 'Query parameter "status" must be an integer.',
        }),
      }),
    );
  });

  test("httpstatus endpoint returns 400 when status is out of range", async () => {
    const response = await request(app).get("/api/v1/httpstatus?status=700");

    expect(response.status).toBe(400);
    expect(response.body).toEqual(
      expect.objectContaining({
        error: expect.objectContaining({
          code: "Invalid status parameter",
          message: 'Query parameter "status" must be between 200 and 599.',
        }),
      }),
    );
  });

  test("httpstatus endpoint returns 400 when status is informational", async () => {
    const response = await request(app).get("/api/v1/httpstatus?status=103");

    expect(response.status).toBe(400);
    expect(response.body).toEqual(
      expect.objectContaining({
        error: expect.objectContaining({
          code: "Invalid status parameter",
          message: 'Query parameter "status" must be between 200 and 599.',
        }),
      }),
    );
  });

  test("httpstatus endpoint returns 400 when status is undocumented informational", async () => {
    const response = await request(app).get("/api/v1/httpstatus?status=129");

    expect(response.status).toBe(400);
    expect(response.body).toEqual(
      expect.objectContaining({
        error: expect.objectContaining({
          code: "Invalid status parameter",
          message: 'Query parameter "status" must be between 200 and 599.',
        }),
      }),
    );
  });
});

describe("requestInsights timestamp provider", () => {
  const fixedTimestamp = "2024-01-01T00:00:00.000Z";
  const timestampProvider = () => fixedTimestamp;

  test("resolveClientIp uses injected timestamp", () => {
    const result = resolveClientIpService({ headers: {}, ip: "127.0.0.1" }, { timestampProvider });
    expect(result.resolvedAt).toBe(fixedTimestamp);
  });

  test("getHelloMessage and getHttpStatus reuse injected timestamp", () => {
    const hello = getHelloMessageService({ timestampProvider });
    const httpStatus = getHttpStatusService({ originalUrl: "/httpstatus?status=403" }, "403", { timestampProvider });
    const noContent = getHttpStatusService({ originalUrl: "/httpstatus?status=204" }, "204", { timestampProvider });

    expect(hello.generatedAt).toBe(fixedTimestamp);
    expect(httpStatus.transportStatus).toBe(403);
    expect(httpStatus.kind).toBe("json");
    expect(httpStatus.body.generatedAt).toBe(fixedTimestamp);
    expect(noContent.transportStatus).toBe(204);
    expect(noContent.kind).toBe("bodyless");
    expect(noContent.headers["X-Generated-At"]).toBe(fixedTimestamp);
    expect(noContent.meta.generatedAt).toBe(fixedTimestamp);
  });
});

describe("HTTP status catalog consistency", () => {
  const surfacedOptions = [...supportedHttpStatusOptions, ...directOnlyHttpStatusOptions];
  const fixedTimestamp = "2024-01-01T00:00:00.000Z";
  const timestampProvider = () => fixedTimestamp;

  test("bodyless status behavior is defined in the shared catalog", () => {
    expect(findHttpStatusCatalogEntry(204)?.bodyBehavior).toBe(HTTP_STATUS_BODY_BEHAVIOR.BODYLESS);
    expect(findHttpStatusCatalogEntry(205)?.bodyBehavior).toBe(HTTP_STATUS_BODY_BEHAVIOR.BODYLESS);
    expect(findHttpStatusCatalogEntry(304)?.bodyBehavior).toBe(HTTP_STATUS_BODY_BEHAVIOR.BODYLESS);
    expect(findHttpStatusCatalogEntry(200)?.bodyBehavior).toBe(HTTP_STATUS_BODY_BEHAVIOR.JSON);
    expect(isBodylessHttpStatus(204)).toBe(true);
    expect(isBodylessHttpStatus(205)).toBe(true);
    expect(isBodylessHttpStatus(304)).toBe(true);
    expect(isBodylessHttpStatus(200)).toBe(false);
  });

  test("every surfaced option is backed by a shared catalog entry", () => {
    surfacedOptions.forEach((option) => {
      const catalogEntry = findHttpStatusCatalogEntry(option.code);
      expect(catalogEntry).toBeDefined();
      expect(option.label).toBe(catalogEntry.label);
      expect(option.group).toBe(catalogEntry.group);
      expect(catalogEntry.description).toEqual(expect.any(String));
    });
  });

  test("getHttpStatus reuses the shared catalog for known surfaced codes", () => {
    surfacedOptions.forEach((option) => {
      const catalogEntry = findHttpStatusCatalogEntry(option.code);
      const result = getHttpStatusService(
        { originalUrl: `/api/v1/httpstatus?status=${option.code}` },
        String(option.code),
        { timestampProvider },
      );

      expect(result.transportStatus).toBe(option.code);
      const metadata = result.kind === "bodyless" ? result.meta : result.body;
      expect(metadata).toEqual(
        expect.objectContaining({
          statusCode: option.code,
          statusText: catalogEntry.label,
          description: catalogEntry.description,
          generatedAt: fixedTimestamp,
        }),
      );
    });
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

});

describeIfClientBundle("SPA fallback", () => {
  test("known routes return index.html with 200 status", async () => {
    const response = await request(app).get("/tools/ip-fqdn");

    expect(response.status).toBe(200);
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
