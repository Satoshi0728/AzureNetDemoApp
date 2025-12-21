import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { readFile } from "node:fs/promises";
import { spaAllowlist, normalizeSpaPath } from "../shared/spa-routes.mjs";

const clientOutDir = process.env.CLIENT_OUT_DIR
  ? path.resolve(process.env.CLIENT_OUT_DIR)
  : path.resolve(__dirname, "dist");

const proxyTarget = process.env.VITE_PROXY_TARGET || process.env.VITE_API_BASE || "http://localhost:8080";

const acceptsHtml = (acceptHeader = "") => acceptHeader.includes("text/html") || acceptHeader.includes("*/*");

const shouldBypassSpaFallback = (pathname) => {
  if (!pathname) return true;
  if (pathname.startsWith("/api")) return true;
  if (pathname.startsWith("/@")) return true;
  if (pathname.startsWith("/__vite")) return true;
  if (pathname === "/index.html") return true;
  const extension = path.extname(pathname);
  return Boolean(extension && extension !== "." && !pathname.endsWith("/"));
};

const getPathname = (url = "/") => {
  try {
    return new URL(url, "http://localhost").pathname;
  } catch (error) {
    return "/";
  }
};

const createSpaFallbackMiddleware = ({ resolveIndexHtml, transformIndexHtml }) =>
  async function spaFallbackMiddleware(req, res, next) {
    if (req.method !== "GET") return next();
    if (!acceptsHtml(req.headers?.accept ?? "")) return next();

    const pathname = getPathname(req.originalUrl || req.url || "/");

    if (shouldBypassSpaFallback(pathname)) {
      return next();
    }

    const normalizedPath = normalizeSpaPath(pathname);
    const statusCode = spaAllowlist.has(normalizedPath) ? 200 : 404;

    try {
      const template = await resolveIndexHtml();
      const html = transformIndexHtml
        ? await transformIndexHtml({ pathname, html: template, req })
        : template;

      res.statusCode = statusCode;
      res.setHeader("Content-Type", "text/html");
      res.end(html);
    } catch (error) {
      next(error);
    }
  };

const spaFallbackPlugin = ({ buildOutDir }) => ({
  name: "kof-spa-fallback",
  configureServer(server) {
    const indexHtmlPath = path.resolve(server.config.root, "index.html");
    const resolveIndexHtml = () => readFile(indexHtmlPath, "utf-8");
    server.middlewares.use(
      createSpaFallbackMiddleware({
        resolveIndexHtml,
        transformIndexHtml: async ({ pathname, html, req }) =>
          server.transformIndexHtml(pathname, html, req?.originalUrl ?? req?.url ?? pathname),
      }),
    );
  },
  configurePreviewServer(server) {
    const previewIndexPath = path.resolve(buildOutDir, "index.html");
    const resolveIndexHtml = () => readFile(previewIndexPath, "utf-8");
    server.middlewares.use(
      createSpaFallbackMiddleware({
        resolveIndexHtml,
      }),
    );
  },
});

export default defineConfig(({ mode }) => ({
  appType: "custom",
  plugins: [react(), spaFallbackPlugin({ buildOutDir: clientOutDir })],
  build: {
    outDir: clientOutDir,
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: proxyTarget,
        changeOrigin: true,
        secure: false,
      },
    },
  },
  define: {
    __APP_BUILD_MODE__: JSON.stringify(mode),
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/setupTests.js"],
    globals: true,
  },
}));
