const DEFAULT_DEV_ORIGINS = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
];

const parseOrigins = (value) =>
  (value ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

const parsedOrigins = parseOrigins(process.env.CORS_ORIGINS);

export const env = {
  port: Number(process.env.WEBSITES_PORT ?? process.env.PORT ?? 8080),
  isProduction: process.env.NODE_ENV === "production",
  allowedOrigins: parsedOrigins.length > 0 ? parsedOrigins : DEFAULT_DEV_ORIGINS,
  corsConfigured: parsedOrigins.length > 0,
};

export const corsOptions = {
  origin(origin, callback) {
    if (!origin) {
      // Same-origin or server-to-server requests have no origin header.
      return callback(null, true);
    }
    if (!env.corsConfigured) {
      // Allow unknown origins during local development; instruct operators via README to configure CORS_ORIGINS in production.
      return callback(null, true);
    }
    if (env.allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error(`Origin "${origin}" is not allowed by CORS policy.`));
  },
  exposedHeaders: ["X-Generated-At", "X-Status-Text"],
  optionsSuccessStatus: 204,
};

export const logSecurityHints = () => {
  if (!env.corsConfigured && env.isProduction) {
    console.warn("[security] CORS_ORIGINS is not set; all origins are currently allowed.");
  }
};
