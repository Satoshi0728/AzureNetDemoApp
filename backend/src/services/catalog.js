const endpointCatalog = Object.freeze([
  // Page endpoints (alphabetical)
  {
    name: "Home",
    path: "/",
    method: "GET",
    category: "page",
    description: "King of Ofuro landing experience with animated content.",
  },
  {
    name: "IP / FQDN",
    path: "/tools/ip-fqdn",
    method: "GET",
    category: "page",
    description: "Shows client IP details alongside host header and request URL in one view.",
  },
  {
    name: "HTTP Status Tester",
    path: "/tools/http-status",
    method: "GET",
    category: "page",
    description: "Lets you inspect selected HTTP status responses in the browser.",
  },
  {
    name: "Hello",
    path: "/tools/hello",
    method: "GET",
    category: "page",
    description: "Greeting sample page.",
  },
  {
    name: "HTTP Headers",
    path: "/tools/http-headers",
    method: "GET",
    category: "page",
    description: "Lists all inbound HTTP headers with Azure-specific highlights.",
  },

  // API endpoints (alphabetical)
  {
    name: "API Health",
    path: "/api/healthz",
    method: "GET",
    category: "api",
    description: "Simple health probe for deployment validation.",
  },
  {
    name: "Client IP API",
    path: "/api/v1/client-ip",
    method: "GET",
    category: "api",
    description: "Standalone resolver for client IP address and source header.",
  },
  {
    name: "IP / FQDN API",
    path: "/api/v1/ip-fqdn",
    method: "GET",
    category: "api",
    description: "Returns client IP info plus host header and URL together.",
  },
  {
    name: "FQDN API",
    path: "/api/v1/fqdn",
    method: "GET",
    category: "api",
    description: "Standalone lookup of host header and request URL.",
  },
  {
    name: "Headers API",
    path: "/api/v1/headers",
    method: "GET",
    category: "api",
    description: "Returns all received headers with importance metadata.",
  },
  {
    name: "HTTP Status API",
    path: "/api/v1/httpstatus?status=403",
    method: "GET",
    category: "api",
    description: "Returns the requested HTTP status code (200–599) with metadata or bodyless headers. Change the status query parameter to any code in that range.",
  },
  {
    name: "Hello API",
    path: "/api/v1/hello",
    method: "GET",
    category: "api",
    description: "Returns the greeting payload used by the Hello page.",
  },
]);

const deepClone = (value) => JSON.parse(JSON.stringify(value));

export const getEndpointCatalog = () => deepClone(endpointCatalog);
