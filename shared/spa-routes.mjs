const rawSpaRoutes = Object.freeze([
  "/",
  "/tools/hello",
  "/tools/ip-fqdn",
  "/tools/http-headers",
  "/tools/http-status",
  "/tools/timetaken",
]);

export const normalizeSpaPath = (value = "/") => {
  if (!value || value === "/") {
    return "/";
  }

  const trimmed = value.trim();
  if (!trimmed || trimmed === "/") {
    return "/";
  }

  const withLeadingSlash = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  const normalized = withLeadingSlash.replace(/\/+$/, "");
  return normalized === "" ? "/" : normalized;
};

export const spaAllowlist = new Set(rawSpaRoutes.map((route) => normalizeSpaPath(route)));

export const spaRoutes = Object.freeze(Array.from(spaAllowlist));

export const isKnownSpaRoute = (candidatePath) => spaAllowlist.has(normalizeSpaPath(candidatePath));
