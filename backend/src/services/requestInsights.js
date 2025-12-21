const IMPORTANT_HEADERS = Object.freeze([
  { key: "accept-encoding", displayName: "Accept-Encoding" },
  { key: "accept-language", displayName: "Accept-Language" },
  { key: "cache-control", displayName: "Cache-Control" },
  { key: "host", displayName: "Host" },
  { key: "cookie", displayName: "Cookie" },
  { key: "max-forwards", displayName: "Max-Forwards" },
  { key: "user-agent", displayName: "User-Agent" },
  { key: "via", displayName: "Via" },
  { key: "x-azure-clientip", displayName: "X-Azure-ClientIP" },
  { key: "x-azure-socketip", displayName: "X-Azure-SocketIP" },
  { key: "x-forwarded-for", displayName: "X-Forwarded-For" },
  { key: "x-client-ip", displayName: "X-Client-IP" },
  { key: "x-forwarded-host", displayName: "X-Forwarded-Host" },
  { key: "x-forwarded-proto", displayName: "X-Forwarded-Proto" },
  { key: "x-forwarded-port", displayName: "X-Forwarded-Port" },
  { key: "x-appgw-trace-id", displayName: "X-AppGW-Trace-Id" },
  { key: "x-azure-ref", displayName: "X-Azure-Ref" },
  { key: "x-azure-fdid", displayName: "X-Azure-FDID" },
]);

const FIRST_IP_PATTERN = /,\s*/;

const HEADER_CANDIDATES = Object.freeze([
  { header: "x-forwarded-for", source: "X-Forwarded-For" },
  { header: "x-client-ip", source: "X-Client-IP" },
  { header: "x-original-forwarded-for", source: "X-Original-Forwarded-For" },
]);

const hasText = (value) => typeof value === "string" && value.trim().length > 0;

const parseHeaderValues = (value) => {
  if (Array.isArray(value)) {
    return value.map((entry) => (entry == null ? "" : String(entry).trim()));
  }
  if (value == null) {
    return [""];
  }
  if (typeof value === "string") {
    return [value.trim()];
  }
  return [String(value).trim()];
};

const toDisplayName = (headerKey) =>
  headerKey
    .split("-")
    .map((part) => (part ? part.charAt(0).toUpperCase() + part.slice(1) : ""))
    .join("-");

const normalizeIp = (ip) => {
  if (!ip) return "";
  if (ip.startsWith("::ffff:")) {
    return ip.substring(7);
  }
  return ip;
};

const defaultTimestampProvider = () => new Date().toISOString();

const resolveTimestampProvider = (options) =>
  typeof options?.timestampProvider === "function" ? options.timestampProvider : defaultTimestampProvider;

export const resolveClientIp = (req, options) => {
  const timestampProvider = resolveTimestampProvider(options);
  let source = "remoteAddr";
  let ip;

  for (const candidate of HEADER_CANDIDATES) {
    const headerValue = req.headers[candidate.header];
    if (!hasText(headerValue)) continue;
    const first = parseHeaderValues(headerValue)[0];
    if (!hasText(first)) continue;
    ip = first.split(FIRST_IP_PATTERN)[0].trim();
    source = candidate.source;
    break;
  }

  if (!hasText(ip)) {
    ip = req.ip || req.connection?.remoteAddress || req.socket?.remoteAddress || "";
  }

  return {
    ip: normalizeIp(ip),
    source,
    resolvedAt: timestampProvider(),
  };
};

export const summarizeHeaders = (req, options) => {
  const timestampProvider = resolveTimestampProvider(options);
  const normalized = new Map();
  Object.entries(req.headers).forEach(([key, rawValue]) => {
    if (!hasText(key)) return;
    const lowerKey = key.toLowerCase();
    const values = parseHeaderValues(rawValue);
    const displayName = toDisplayName(lowerKey);
    normalized.set(lowerKey, {
      displayName,
      values,
      present: values.some((value) => hasText(value)),
    });
  });

  const rows = [];

  IMPORTANT_HEADERS.forEach((important) => {
    const entry = normalized.get(important.key);
    if (entry) {
      normalized.delete(important.key);
    }
    rows.push({
      displayName: important.displayName,
      values: entry?.values ?? [],
      important: true,
      present: entry?.present ?? false,
    });
  });

  const remaining = Array.from(normalized.values()).sort((a, b) =>
    a.displayName.localeCompare(b.displayName, "en"),
  );

  remaining.forEach((entry) => {
    rows.push({
      displayName: entry.displayName,
      values: entry.values,
      important: false,
      present: entry.present,
    });
  });

  return {
    receivedAt: timestampProvider(),
    headers: rows,
  };
};

export const describeFqdn = (req, options) => {
  const timestampProvider = resolveTimestampProvider(options);
  const hostHeader = req.get("host") || "";
  const protocol = req.protocol || "http";
  let url;
  try {
    url = new URL(req.originalUrl || "/", `${protocol}://${hostHeader || req.hostname || "localhost"}`).toString();
  } catch {
    url = `${protocol}://${hostHeader}${req.originalUrl || "/"}`;
  }

  return {
    host: hostHeader,
    url,
    inspectedAt: timestampProvider(),
  };
};

export const getHelloMessage = (options) => {
  const timestampProvider = resolveTimestampProvider(options);
  return {
    title: "Hello, Network World!",
    message: "Just a test page! ✨",
    generatedAt: timestampProvider(),
  };
};

export const getForbidden = (req, options) => {
  const timestampProvider = resolveTimestampProvider(options);
  return {
    error: {
      code: "403 Page",
      message: "Access to this resource is forbidden.",
    },
    generatedAt: timestampProvider(),
    path: req.originalUrl,
  };
};
