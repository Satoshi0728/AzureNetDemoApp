#!/usr/bin/env node
import process from "node:process";

const parseArgs = () => {
  const args = process.argv.slice(2);
  const config = {
    baseUrl: process.env.BASE_URL || "",
    timeout: Number(process.env.MONITOR_TIMEOUT ?? "10000"),
  };

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if ((arg === "--base" || arg === "--base-url") && args[i + 1]) {
      config.baseUrl = args[i + 1];
      i += 1;
    } else if (arg.startsWith("--base=")) {
      config.baseUrl = arg.split("=")[1];
    } else if ((arg === "--timeout" || arg === "-t") && args[i + 1]) {
      config.timeout = Number(args[i + 1]);
      i += 1;
    }
  }

  return config;
};

const { baseUrl, timeout } = parseArgs();

if (!baseUrl) {
  console.error("Usage: node monitoring/ping-endpoints.js --base https://your-app.azurewebsites.net");
  process.exit(1);
}

const endpoints = [
  { path: "/api/healthz", expectStatus: 200 },
  { path: "/api/v1/httpstatus?status=403", expectStatus: 403 },
];

const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), timeout);

const ping = async (endpoint) => {
  const url = new URL(endpoint.path, baseUrl).toString();
  const startedAt = Date.now();
  try {
    const response = await fetch(url, { signal: controller.signal, redirect: "manual" });
    const duration = Date.now() - startedAt;
    if (response.status !== endpoint.expectStatus) {
      return {
        ok: false,
        message: `[FAIL] ${url} responded with ${response.status} (expected ${endpoint.expectStatus}) in ${duration}ms`,
      };
    }
    return {
      ok: true,
      message: `[PASS] ${url} responded with ${response.status} in ${duration}ms`,
    };
  } catch (error) {
    return {
      ok: false,
      message: `[ERROR] ${endpoint.path} failed: ${error.name ?? "Error"} ${error.message ?? ""}`.trim(),
    };
  }
};

const run = async () => {
  const results = await Promise.all(endpoints.map(ping));
  clearTimeout(timeoutId);

  let ok = true;
  results.forEach((result) => {
    if (!result.ok) {
      ok = false;
    }
    console.log(result.message);
  });

  if (!ok) {
    process.exitCode = 1;
  }
};

run();
