import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import compression from "compression";
import helmet from "helmet";
import cors from "cors";
import morgan from "morgan";
import apiRouter from "./routes/api.js";
import { corsOptions, env } from "./config/env.js";
import { spaAllowlist, normalizeSpaPath } from "../../shared/spa-routes.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const buildDir = path.join(rootDir, "public");
const candidateClientDir = path.join(buildDir, "client");
const fallbackClientDir = path.resolve(rootDir, "../frontend/dist");

const resolveClientDir = () => {
  if (fs.existsSync(candidateClientDir)) return candidateClientDir;
  if (fs.existsSync(fallbackClientDir)) return fallbackClientDir;
  return null;
};

export const createApp = () => {
  const clientDir = resolveClientDir();
  const app = express();

  app.disable("x-powered-by");
  app.set("trust proxy", 1);
  app.use(
    helmet({
      contentSecurityPolicy: {
        useDefaults: true,
        directives: {
          "img-src": ["'self'", "data:"],
          "script-src": ["'self'"],
          "style-src": ["'self'", "https://fonts.googleapis.com"],
          "font-src": ["'self'", "https://fonts.gstatic.com"],
        },
      },
      crossOriginEmbedderPolicy: false,
    }),
  );
  app.use(cors(corsOptions));
  app.use((err, req, res, next) => {
    if (err?.message?.includes("CORS")) {
      return res.status(403).json({
        error: { message: "Origin not allowed." },
      });
    }
    return next(err);
  });
  app.use(compression());
  app.use(
    express.json({
      limit: "64kb",
      type: ["application/json", "application/*+json"],
    }),
  );
  app.use((err, req, res, next) => {
    if (err instanceof SyntaxError && err.status === 400 && "body" in err) {
      return res.status(400).json({
        error: {
          message: "Invalid JSON payload.",
          reference: env.isProduction ? undefined : err.message,
        },
      });
    }
    return next(err);
  });
  app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));

  app.use("/api", apiRouter);

  if (clientDir) {
    app.use(
      express.static(clientDir, {
        maxAge: process.env.NODE_ENV === "production" ? "1h" : 0,
        setHeaders(res, filePath) {
          if (filePath.endsWith(".html")) {
            res.setHeader("Cache-Control", "no-cache");
          }
        },
      }),
    );
  }

  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api")) {
      return next();
    }
    if (!clientDir) {
      return res.status(503).send("Client build not available.");
    }
    const normalizedPath = normalizeSpaPath(req.path);
    if (normalizedPath === "/tools/forbidden") {
      return res.status(403).sendFile(path.join(clientDir, "index.html"));
    }
    const statusCode = spaAllowlist.has(normalizedPath) ? 200 : 404;
    return res.status(statusCode).sendFile(path.join(clientDir, "index.html"));
  });

  app.use((err, req, res, next) => {
    console.error(err);
    res.status(500).json({
      error: {
        message: "Internal Server Error",
        reference: process.env.NODE_ENV === "production" ? undefined : err.message,
      },
    });
  });

  return { app, clientDir, port: env.port };
};
